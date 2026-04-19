import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import Redis from 'ioredis';
import { loadEnv } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

export type RuntimeAiConfig = {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  imageModel: string;
  mockEnabled: boolean;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getRedis(): Redis | null {
    if (this.redis) {
      return this.redis;
    }
    try {
      this.redis = new Redis(loadEnv().redisUrl, { maxRetriesPerRequest: 1 });
      return this.redis;
    } catch (e) {
      this.logger.warn(`Redis unavailable for AI limiter: ${(e as Error).message}`);
      return null;
    }
  }

  private dayKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  private async enforceLimit(tokensEstimate: number) {
    const env = loadEnv();
    const r = this.getRedis();
    if (!r) {
      return;
    }
    const key = `ai:usage:${this.dayKey()}`;
    const n = await r.incrby(key, Math.max(1, tokensEstimate));
    if (n === Math.max(1, tokensEstimate)) {
      await r.expire(key, 60 * 60 * 36);
    }
    if (n > env.aiDailyLimit * 1000) {
      throw new Error('AI daily usage limit exceeded');
    }
  }

  async resolveRuntimeConfig(): Promise<RuntimeAiConfig> {
    const env = loadEnv();
    let row: {
      baseUrl: string;
      apiKey: string | null;
      chatModel: string;
      imageModel: string;
      mockEnabled: boolean;
    } | null = null;
    try {
      row = await this.prisma.aiSettings.findUnique({ where: { id: 1 } });
    } catch (e) {
      this.logger.warn(`AiSettings read failed: ${(e as Error).message}`);
    }
    const baseUrl = (row?.baseUrl?.trim() || env.openaiBaseUrl).replace(/\/$/, '');
    const apiKey = (row?.apiKey?.trim() || env.openaiApiKey || '').trim();
    const chatModel = row?.chatModel?.trim() || 'gpt-4o-mini';
    const imageModel = row?.imageModel?.trim() || 'gpt-image-1';
    const mockEnabled = row ? row.mockEnabled : env.aiMockEnabled;
    return { baseUrl, apiKey, chatModel, imageModel, mockEnabled };
  }

  private async runChatCompletions(cfg: RuntimeAiConfig, prompt: string): Promise<string> {
    await this.enforceLimit(Math.ceil(prompt.length / 4));
    if (cfg.mockEnabled || !cfg.apiKey) {
      return `[mock-ai] ${prompt.slice(0, 200)}`;
    }
    const res = await axios.post(
      `${cfg.baseUrl}/chat/completions`,
      {
        model: cfg.chatModel,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      },
    );
    return res.data?.choices?.[0]?.message?.content ?? '';
  }

  async chat(prompt: string): Promise<string> {
    return this.runChatCompletions(await this.resolveRuntimeConfig(), prompt);
  }

  /** For settings UI: merge unsaved form fields over persisted config, then call chat/completions. */
  async chatWithOptionalOverrides(
    prompt: string,
    overrides: Partial<Pick<RuntimeAiConfig, 'baseUrl' | 'apiKey' | 'chatModel' | 'imageModel' | 'mockEnabled'>>,
  ): Promise<string> {
    const base = await this.resolveRuntimeConfig();
    const cfg: RuntimeAiConfig = {
      baseUrl: (overrides.baseUrl?.trim() || base.baseUrl).replace(/\/$/, ''),
      apiKey:
        overrides.apiKey !== undefined && overrides.apiKey.trim() !== ''
          ? overrides.apiKey.trim()
          : base.apiKey,
      chatModel: overrides.chatModel?.trim() || base.chatModel,
      imageModel: overrides.imageModel?.trim() || base.imageModel,
      mockEnabled: overrides.mockEnabled !== undefined ? overrides.mockEnabled : base.mockEnabled,
    };
    return this.runChatCompletions(cfg, prompt);
  }

  async generateImage(prompt: string): Promise<string> {
    const cfg = await this.resolveRuntimeConfig();
    await this.enforceLimit(1000);
    if (cfg.mockEnabled || !cfg.apiKey) {
      return Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ).toString('base64');
    }
    const res = await axios.post(
      `${cfg.baseUrl}/images/generations`,
      {
        model: cfg.imageModel,
        prompt,
        size: '256x256',
      },
      {
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      },
    );
    const b64 = res.data?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('Image generation returned empty payload');
    }
    return b64 as string;
  }
}
