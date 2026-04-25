import { Body, Controller, Post } from '@nestjs/common';
import { ScriptRunnerService } from './script-runner.service';
import { DebugScriptDto } from './dto/debug-script.dto';

export type DebugScriptSuccess =
  | { ok: true; kind: 'object'; result: Record<string, unknown> }
  | { ok: true; kind: 'echartsOption'; result: Record<string, unknown> }
  | {
      ok: true;
      kind: 'base64';
      /** Raw base64 without data URL prefix */
      result: string;
      /** Safe preview for UI */
      preview: string;
      length: number;
    };

export type DebugScriptFailure = {
  ok: false;
  message: string;
  name?: string;
  stack?: string;
};

@Controller('scripts')
export class ScriptsDebugController {
  constructor(private readonly scripts: ScriptRunnerService) {}

  @Post('debug')
  async debug(@Body() dto: DebugScriptDto): Promise<DebugScriptSuccess | DebugScriptFailure> {
    const params = dto.params ?? {};
    try {
      if (dto.elementType === 'TEXT') {
        const result = (await this.scripts.runFetchData(dto.script, params)) as Record<string, unknown>;
        return { ok: true, kind: 'object', result };
      }
      if (dto.elementType === 'CHART') {
        const result = (await this.scripts.runGenerateChartOption(dto.script, params)) as Record<string, unknown>;
        return { ok: true, kind: 'echartsOption', result };
      }
      const result = (await this.scripts.runGenerateChart(dto.script, params)) as string;
      const preview = result.length > 160 ? `${result.slice(0, 160)}…` : result;
      return { ok: true, kind: 'base64', result, preview, length: result.length };
    } catch (e) {
      const err = e as Error;
      return {
        ok: false,
        message: err.message || String(e),
        name: err.name,
        stack: err.stack,
      };
    }
  }
}
