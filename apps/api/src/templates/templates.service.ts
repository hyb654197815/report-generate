import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import mammoth from 'mammoth';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PdfMetaService } from '../pdf/pdf-meta.service';
import { GotenbergService } from '../convert/gotenberg.service';
import { ElementInputDto } from './dto/save-elements.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdfMeta: PdfMetaService,
    private readonly gotenberg: GotenbergService,
  ) {}

  list() {
    return this.prisma.reportTemplate.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async get(id: number) {
    const t = await this.prisma.reportTemplate.findUnique({
      where: { id },
      include: { elements: true },
    });
    if (!t) {
      throw new NotFoundException('Template not found');
    }
    return t;
  }

  async create(name: string, type = 2) {
    return this.prisma.reportTemplate.create({
      data: { name, type, width: 595, height: 842 },
    });
  }

  async updateMeta(id: number, data: { name?: string }) {
    await this.ensureTemplate(id);
    return this.prisma.reportTemplate.update({ where: { id }, data });
  }

  async remove(id: number) {
    const t = await this.ensureTemplate(id);
    for (const key of [t.backgroundPdfUrl, t.draftHtmlUrl].filter(
      (k): k is string => Boolean(k),
    )) {
      try {
        await this.storage.deleteObject(key);
      } catch (e) {
        this.logger.warn(
          `Failed to delete storage object ${key}: ${(e as Error).message}`,
        );
      }
    }
    await this.prisma.reportTemplate.delete({ where: { id } });
  }

  private async ensureTemplate(id: number) {
    const t = await this.prisma.reportTemplate.findUnique({ where: { id } });
    if (!t) {
      throw new NotFoundException('Template not found');
    }
    return t;
  }

  async uploadBackgroundPdf(templateId: number, file: Express.Multer.File) {
    await this.ensureTemplate(templateId);
    const pdfBuf = file.buffer;
    const { width, height } = await this.pdfMeta.readPageSize(pdfBuf);
    const key = `templates/${templateId}/background.pdf`;
    await this.storage.putObject(key, pdfBuf, 'application/pdf');
    return this.prisma.reportTemplate.update({
      where: { id: templateId },
      data: {
        type: 2,
        backgroundPdfUrl: key,
        width,
        height,
        draftHtmlUrl: null,
      },
    });
  }

  async uploadBackgroundDocx(templateId: number, file: Express.Multer.File) {
    await this.ensureTemplate(templateId);
    const { value: html } = await mammoth.convertToHtml({
      buffer: file.buffer,
    });
    const draftKey = `templates/${templateId}/draft.html`;
    await this.storage.putObject(
      draftKey,
      Buffer.from(html, 'utf-8'),
      'text/html; charset=utf-8',
    );
    return this.prisma.reportTemplate.update({
      where: { id: templateId },
      data: {
        type: 1,
        draftHtmlUrl: draftKey,
        backgroundPdfUrl: null,
      },
    });
  }

  async renderBackgroundFromHtml(templateId: number, html: string) {
    await this.ensureTemplate(templateId);
    const pdfBuf = await this.gotenberg.htmlToPdf(html);
    const { width, height } = await this.pdfMeta.readPageSize(pdfBuf);
    const key = `templates/${templateId}/background.pdf`;
    await this.storage.putObject(key, pdfBuf, 'application/pdf');
    return this.prisma.reportTemplate.update({
      where: { id: templateId },
      data: {
        backgroundPdfUrl: key,
        width,
        height,
      },
    });
  }

  async getBackgroundPdfBuffer(templateId: number) {
    const t = await this.ensureTemplate(templateId);
    if (!t.backgroundPdfUrl) {
      throw new BadRequestException('Template has no background PDF');
    }
    return this.storage.getObjectBuffer(t.backgroundPdfUrl);
  }

  async getDraftHtml(templateId: number) {
    const t = await this.ensureTemplate(templateId);
    if (!t.draftHtmlUrl) {
      throw new BadRequestException('No draft HTML for this template');
    }
    const buf = await this.storage.getObjectBuffer(t.draftHtmlUrl);
    return buf.toString('utf-8');
  }

  async saveElements(templateId: number, elements: ElementInputDto[]) {
    await this.ensureTemplate(templateId);
    await this.prisma.$transaction(async (tx) => {
      await tx.templateElement.deleteMany({ where: { templateId } });
      if (elements.length === 0) {
        return;
      }
      await tx.templateElement.createMany({
        data: elements.map((e) => ({
          templateId,
          componentId: e.componentId ?? null,
          elementType: e.elementType,
          positionJson: JSON.stringify(e.position),
          scriptCode: e.scriptCode ?? null,
          staticContent: e.staticContent ?? null,
          styleConfig: e.styleConfig ?? null,
        })),
      });
    });
    return this.prisma.templateElement.findMany({ where: { templateId } });
  }
}
