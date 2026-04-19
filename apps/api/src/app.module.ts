import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AiModule } from './ai/ai.module';
import { ScriptsModule } from './scripts/scripts.module';
import { PdfModule } from './pdf/pdf.module';
import { ConvertModule } from './convert/convert.module';
import { TemplatesModule } from './templates/templates.module';
import { ComponentsModule } from './components/components.module';
import { ReportsModule } from './reports/reports.module';
import { AiSettingsModule } from './ai-settings/ai-settings.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AiModule,
    AiSettingsModule,
    ScriptsModule,
    PdfModule,
    ConvertModule,
    TemplatesModule,
    ComponentsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
