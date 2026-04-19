import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PdfRect } from './pdf-view-rect';
import { viewQuadrupleToRect } from './pdf-view-rect';

const requireFromApi = createRequire(join(__dirname, '../../package.json'));

let workerConfigured = false;

/**
 * Same `page.view` as the browser pdf.js uses — avoids pdf-lib Crop/Media
 * intersection edge cases that cause large placement drift.
 */
export async function getPdfJsViewRect(
  pdfBytes: Uint8Array,
  pageNumber1Based: number,
): Promise<PdfRect> {
  const legacyPath = requireFromApi.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = (await import(legacyPath)) as {
    getDocument: (params: Record<string, unknown>) => { promise: Promise<any> };
    GlobalWorkerOptions: { workerSrc?: string };
  };

  if (!workerConfigured && !pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const workerPath = requireFromApi.resolve('pdfjs-dist/build/pdf.worker.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    } catch {
      /* optional */
    }
    workerConfigured = true;
  }

  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(pageNumber1Based);
    const v = page.view as number[];
    return viewQuadrupleToRect([v[0], v[1], v[2], v[3]]);
  } finally {
    await doc.destroy();
  }
}

/**
 * Get viewport bounding box in PDF user space (accounts for page rotation).
 * This matches the browser pdf.js viewport behavior used in the designer.
 */
export async function getPdfJsViewportRect(
  pdfBytes: Uint8Array,
  pageNumber1Based: number,
  scale = 1.25,
): Promise<PdfRect> {
  const legacyPath = requireFromApi.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = (await import(legacyPath)) as {
    getDocument: (params: Record<string, unknown>) => { promise: Promise<any> };
    GlobalWorkerOptions: { workerSrc?: string };
  };

  if (!workerConfigured && !pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const workerPath = requireFromApi.resolve('pdfjs-dist/build/pdf.worker.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    } catch {
      /* optional */
    }
    workerConfigured = true;
  }

  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(pageNumber1Based);
    const viewport = page.getViewport({ scale });
    // Calculate viewport bounds in PDF user space (same as browser)
    const vw = viewport.width;
    const vh = viewport.height;
    const pdfOrigin = viewport.convertToPdfPoint(0, 0);
    const pdfTopRight = viewport.convertToPdfPoint(vw, 0);
    const pdfBottomLeft = viewport.convertToPdfPoint(0, vh);
    const pdfBottomRight = viewport.convertToPdfPoint(vw, vh);
    const xs = [pdfOrigin[0], pdfTopRight[0], pdfBottomLeft[0], pdfBottomRight[0]];
    const ys = [pdfOrigin[1], pdfTopRight[1], pdfBottomLeft[1], pdfBottomRight[1]];
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  } finally {
    await doc.destroy();
  }
}
