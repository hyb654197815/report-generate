import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ScriptRunnerService } from '../scripts/script-runner.service';
import { GotenbergService } from '../convert/gotenberg.service';
import { replacePlaceholdersInHtml } from '../lib/placeholder-replace';
import { normRectToPdfLib, NormRect } from '../lib/pdf-rect';
import { getPdfJsViewportRect } from '../lib/pdfjs-page-view';
import type { PdfRect } from '../lib/pdf-view-rect';
import { pageDisplayViewRect } from '../lib/pdf-view-rect';

@Injectable()
export class ReportsService {
  private static echartsBundleCache: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly scripts: ScriptRunnerService,
    private readonly gotenberg: GotenbergService,
  ) {}

  private loadEchartsBundle(): string {
    if (ReportsService.echartsBundleCache) {
      return ReportsService.echartsBundleCache;
    }
    const bundlePath = require.resolve('echarts/dist/echarts.min.js');
    ReportsService.echartsBundleCache = readFileSync(bundlePath, 'utf-8');
    return ReportsService.echartsBundleCache;
  }

  async generate(templateId: number, params: Record<string, unknown>) {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { id: templateId },
      include: {
        elements: { include: { component: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    if (!template.backgroundPdfUrl) {
      throw new BadRequestException('Template has no background PDF yet');
    }
    const bgBytes = await this.storage.getObjectBuffer(
      template.backgroundPdfUrl,
    );
    const pdfDoc = await PDFDocument.load(bgBytes, { ignoreEncryption: true });
    const bgU8 = bgBytes instanceof Uint8Array ? bgBytes : new Uint8Array(bgBytes);

    // Cache for pdf.js viewport (same as frontend) - ensures consistent coordinate system
    const pdfJsViewportCache = new Map<number, PdfRect>();

    const viewportForElement = async (pageNum1Based: number): Promise<PdfRect> => {
      if (!pdfJsViewportCache.has(pageNum1Based)) {
        try {
          // Use pdf.js viewport (scale=1.25 matches frontend PDF_SCALE)
          pdfJsViewportCache.set(
            pageNum1Based,
            await getPdfJsViewportRect(bgU8, pageNum1Based, 1.25),
          );
        } catch {
          // Fallback to pdf-lib's page display rect
          const page = pdfDoc.getPage(pageNum1Based - 1);
          pdfJsViewportCache.set(pageNum1Based, pageDisplayViewRect(page));
        }
      }
      return pdfJsViewportCache.get(pageNum1Based)!;
    };

    for (const el of template.elements) {
      const pos = JSON.parse(el.positionJson) as NormRect;
      const pageIndex = pos.page - 1;
      if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) {
        continue;
      }
      const page = pdfDoc.getPage(pageIndex);
      // Get viewport bounds (matches frontend Canvas coordinate system)
      const view = await viewportForElement(pos.page);
      // Convert percentage (0-1) to PDF coordinates
      const rect = normRectToPdfLib(pos, view);

      if (el.elementType === 'TEXT') {
        let html = el.staticContent || '';
        if (!html && el.component?.defaultConfig) {
          try {
            const cfg = JSON.parse(el.component.defaultConfig) as {
              richHtml?: string;
            };
            html = cfg.richHtml || '';
          } catch {
            html = '';
          }
        }
        let data: Record<string, unknown> = {};
        const script =
          (el.scriptCode && el.scriptCode.trim()) ||
          el.component?.defaultScript ||
          '';
        if (script.trim()) {
          data = (await this.scripts.runFetchData(
            script,
            params,
          )) as Record<string, unknown>;
        }
        const filled = replacePlaceholdersInHtml(html, data);
        const overlayPdf = await this.gotenberg.htmlToPdfInBox(
          rect.width,
          rect.height,
          filled,
        );
        const [embeddedPage] = await pdfDoc.embedPdf(overlayPdf, [0]);
        page.drawPage(embeddedPage, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      } else if (el.elementType === 'IMAGE') {
        const script =
          (el.scriptCode && el.scriptCode.trim()) ||
          el.component?.defaultScript ||
          '';
        if (!script.trim()) {
          continue;
        }
        const b64 = (await this.scripts.runGenerateChart(
          script,
          params,
        )) as string;
        const bytes = Buffer.from(b64, 'base64');
        let embedded;
        try {
          embedded = await pdfDoc.embedPng(bytes);
        } catch {
          embedded = await pdfDoc.embedJpg(bytes);
        }
        page.drawImage(embedded, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      } else if (el.elementType === 'CHART') {
        const script =
          (el.scriptCode && el.scriptCode.trim()) ||
          el.component?.defaultScript ||
          '';
        if (!script.trim()) {
          continue;
        }
        const option = (await this.scripts.runGenerateChartOption(
          script,
          params,
        )) as Record<string, unknown>;
        const widthPx = Math.max(1, Math.floor(rect.width * 2));
        const heightPx = Math.max(1, Math.floor(rect.height * 2));
        const optionJson = JSON.stringify(option).replace(/</g, '\\u003c');
        const echartsBundle = this.loadEchartsBundle();
        const chartHtml = `
          <div id="chart" style="width:${widthPx}px;height:${heightPx}px;"></div>
          <script>${echartsBundle}</script>
          <script>
            const option = ${optionJson};
            const chart = echarts.init(document.getElementById('chart'));
            chart.setOption(option);
          </script>
        `;
        const pngBytes = await this.gotenberg.htmlToPng(chartHtml, widthPx, heightPx, {
          waitDelayMs: 1200,
        });
        const embedded = await pdfDoc.embedPng(pngBytes);
        page.drawImage(embedded, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    const out = await pdfDoc.save();
    return Buffer.from(out);
  }
}
