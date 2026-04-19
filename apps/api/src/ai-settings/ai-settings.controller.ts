import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { UpdateAiSettingsDto, TestChatDto } from './dto/update-ai-settings.dto';

@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly aiSettings: AiSettingsService) {}

  @Get()
  get() {
    return this.aiSettings.getPublic();
  }

  @Put()
  put(@Body() dto: UpdateAiSettingsDto) {
    return this.aiSettings.update(dto);
  }

  @Post('test-chat')
  test(@Body() dto: TestChatDto) {
    return this.aiSettings.testChat(dto);
  }
}
