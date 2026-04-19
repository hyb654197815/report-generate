import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../config/env.schema';
import { createSandboxHttp } from './sandbox-http';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ScriptRunnerService {
  private readonly logger = new Logger(ScriptRunnerService.name);

  constructor(private readonly ai: AiService) {}

  async runFetchData(script: string, params: Record<string, unknown>) {
    return this.run(script, params, 'object');
  }

  async runGenerateChart(script: string, params: Record<string, unknown>) {
    return this.run(script, params, 'base64');
  }

  private async run(
    script: string,
    params: Record<string, unknown>,
    expect: 'object' | 'base64',
  ): Promise<unknown> {
    const env = loadEnv();
    const http = createSandboxHttp(env.httpAllowlistHosts);
    const ai = {
      chat: (p: string) => this.ai.chat(p),
      generateImage: (p: string) => this.ai.generateImage(p),
    };
    const AsyncFunction = Object.getPrototypeOf(async function () {})
      .constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;

    const body = `
      ${script}
      const __fn = typeof fetchData !== 'undefined'
        ? fetchData
        : (typeof generateChart !== 'undefined' ? generateChart : null);
      if (!__fn) {
        throw new Error('Script must define fetchData or generateChart');
      }
      return await __fn({ http, ai, params });
    `;

    const fn = new AsyncFunction('http', 'ai', 'params', body);
    const timeoutMs = env.scriptTimeoutMs;
    const result = await Promise.race([
      fn(http, ai, params),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('Script timeout')), timeoutMs),
      ),
    ]);

    if (expect === 'object') {
      if (result === null || typeof result !== 'object' || Array.isArray(result)) {
        throw new Error('fetchData must return a plain object');
      }
      try {
        JSON.stringify(result);
      } catch {
        throw new Error('fetchData return value must be JSON-serializable');
      }
    } else if (expect === 'base64') {
      if (typeof result !== 'string' || result.trim() === '') {
        throw new Error('generateChart must return a non-empty base64 string');
      }
      const s = result.replace(/^data:image\/\w+;base64,/, '');
      if (!/^[A-Za-z0-9+/=]+$/.test(s)) {
        throw new Error('generateChart must return raw base64');
      }
      return s;
    }

    return result;
  }
}
