import { Module } from '@nestjs/common';
import { PdfMetaService } from './pdf-meta.service';

@Module({
  providers: [PdfMetaService],
  exports: [PdfMetaService],
})
export class PdfModule {}
