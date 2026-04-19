import { Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class PdfMetaService {
  async readPageSize(buffer: Buffer): Promise<{ width: number; height: number }> {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    return { width, height };
  }
}
