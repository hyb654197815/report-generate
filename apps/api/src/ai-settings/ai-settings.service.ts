import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { loadEnv } from '../config/env.schema';
import { AiService } from '../ai/ai.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';

export type PublicAiSettings = {
  baseUrl: string;
  chatModel: string;
  imageModel: string;
  mockEnabled: boolean;
  hasApiKey: boolean;
};

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async getPublic(): Promise<PublicAiSettings> {
    const env = loadEnv();
    const row = await this.prisma.aiSettings.findUnique({ where: { id: 1 } });
    const baseUrl = (row?.baseUrl?.trim() || env.openaiBaseUrl).replace(/\/$/, '');
    const chatModel = row?.chatModel?.trim() || 'gpt-4o-mini';
    const imageModel = row?.imageModel?.trim() || 'gpt-image-1';
    const mockEnabled = row ? row.mockEnabled : env.aiMockEnabled;
    const hasApiKey = Boolean((row?.apiKey?.trim() || env.openaiApiKey || '').length);
    return { baseUrl, chatModel, imageModel, mockEnabled, hasApiKey };
  }

  async update(dto: UpdateAiSettingsDto) {
    const env = loadEnv();
    const cur = await this.prisma.aiSettings.findUnique({ where: { id: 1 } });
    const baseUrl = (dto.baseUrl?.trim() || cur?.baseUrl || env.openaiBaseUrl).replace(/\/$/, '');
    const chatModel = dto.chatModel?.trim() || cur?.chatModel || 'gpt-4o-mini';
    const imageModel = dto.imageModel?.trim() || cur?.imageModel || 'gpt-image-1';
    const mockEnabled =
      dto.mockEnabled !== undefined ? dto.mockEnabled : (cur?.mockEnabled ?? env.aiMockEnabled);

    const updatePayload: {
      baseUrl: string;
      chatModel: string;
      imageModel: string;
      mockEnabled: boolean;
      apiKey?: string | null;
    } = {
      baseUrl,
      chatModel,
      imageModel,
      mockEnabled,
    };

    if (dto.apiKey !== undefined && dto.apiKey.trim() !== '') {
      updatePayload.apiKey = dto.apiKey.trim();
    }

    await this.prisma.aiSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        baseUrl,
        chatModel,
        imageModel,
        mockEnabled,
        apiKey: dto.apiKey?.trim() || null,
      },
      update: updatePayload,
    });

    return this.getPublic();
  }

  async testChat(dto: {
    prompt?: string;
    baseUrl?: string;
    chatModel?: string;
    mockEnabled?: boolean;
    apiKey?: string;
  }) {
    const prompt = (dto.prompt?.trim() || '用一句话回复：连接成功。').slice(0, 8000);
    const text = await this.ai.chatWithOptionalOverrides(prompt, {
      baseUrl: dto.baseUrl,
      chatModel: dto.chatModel,
      mockEnabled: dto.mockEnabled,
      apiKey: dto.apiKey,
    });
    return { reply: text };
  }
}
