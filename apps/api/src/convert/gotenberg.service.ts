import { Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { loadEnv } from '../config/env.schema';

@Injectable()
export class GotenbergService {
  private baseUrl() {
    return loadEnv().gotenbergUrl.replace(/\/$/, '');
  }

  async htmlToPdf(
    html: string,
    opts?: {
      preferCssPageSize?: boolean;
      zeroMargins?: boolean;
      paperWidth?: string;
      paperHeight?: string;
    },
  ): Promise<Buffer> {
    const fd = new FormData();
    fd.append('files', Buffer.from(html, 'utf-8'), {
      filename: 'index.html',
      contentType: 'text/html',
    });
    if (opts?.preferCssPageSize) {
      fd.append('preferCssPageSize', 'true');
    }
    if (opts?.paperWidth) {
      fd.append('paperWidth', opts.paperWidth);
    }
    if (opts?.paperHeight) {
      fd.append('paperHeight', opts.paperHeight);
    }
    if (opts?.zeroMargins) {
      fd.append('marginTop', '0');
      fd.append('marginBottom', '0');
      fd.append('marginLeft', '0');
      fd.append('marginRight', '0');
    }
    const url = `${this.baseUrl()}/forms/chromium/convert/html`;
    const res = await axios.post(url, fd, {
      headers: fd.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 120_000,
    });
    return Buffer.from(res.data);
  }

  /**
   * Renders a single-page PDF whose page box matches the given size in points.
   * Text stays as real PDF text (selectable), unlike raster screenshots.
   */
  async htmlToPdfInBox(widthPt: number, heightPt: number, bodyHtml: string): Promise<Buffer> {
    const w = Math.max(1, widthPt);
    const h = Math.max(1, heightPt);
    /** Explicit paper size + zero margins so Chromium page box matches the template rect (pt). */
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
html, body { margin: 0; padding: 0; box-sizing: border-box; width: ${w}pt; height: ${h}pt; overflow: hidden; }
body { font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans CJK SC", "Noto Sans SC", sans-serif; }
</style></head><body>${bodyHtml}</body></html>`;
    return this.htmlToPdf(doc, {
      preferCssPageSize: false,
      zeroMargins: true,
      paperWidth: `${w}pt`,
      paperHeight: `${h}pt`,
    });
  }

  async htmlToPng(
    htmlFragment: string,
    widthPx: number,
    heightPx: number,
  ): Promise<Buffer> {
    const w = Math.max(1, Math.floor(widthPx));
    const h = Math.max(1, Math.floor(heightPx));
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>html,body{margin:0;padding:0;box-sizing:border-box;}body{width:${w}px;min-height:${h}px;}</style></head><body>${htmlFragment}</body></html>`;
    const fd = new FormData();
    fd.append('files', Buffer.from(doc, 'utf-8'), {
      filename: 'index.html',
      contentType: 'text/html',
    });
    fd.append('width', String(w));
    fd.append('height', String(h));
    fd.append('clip', 'true');
    fd.append('format', 'png');
    const url = `${this.baseUrl()}/forms/chromium/screenshot/html`;
    const res = await axios.post(url, fd, {
      headers: fd.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 120_000,
    });
    return Buffer.from(res.data);
  }

  async docxToPdf(docx: Buffer): Promise<Buffer> {
    const fd = new FormData();
    fd.append('files', docx, {
      filename: 'document.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = `${this.baseUrl()}/forms/libreoffice/convert`;
    const res = await axios.post(url, fd, {
      headers: fd.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 120_000,
    });
    return Buffer.from(res.data);
  }
}
