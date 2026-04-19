import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { PdfModule } from '../pdf/pdf.module';
import { ConvertModule } from '../convert/convert.module';

@Module({
  imports: [PdfModule, ConvertModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
