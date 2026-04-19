import type { PDFPage } from 'pdf-lib';

export type PdfRect = { x: number; y: number; width: number; height: number };

/**
 * Intersection of two axis-aligned rectangles (same logic as pdf.js page.view).
 */
export function intersectPdfRects(a: PdfRect, b: PdfRect): PdfRect {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 <= x0 || y1 <= y0) {
    return a;
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Visible page box in PDF user space — matches pdf.js {@link PDFPageProxy#view}
 * (intersect CropBox with MediaBox when they differ).
 */
export function pageDisplayViewRect(page: PDFPage): PdfRect {
  return intersectPdfRects(page.getMediaBox(), page.getCropBox());
}

/** Normalize pdf.js / PDF `view` quadruple [x0,y0,x1,y1] (any corner order) to x,y,width,height. */
export function viewQuadrupleToRect(v: number[]): PdfRect {
  const x0 = Math.min(v[0], v[2]);
  const x1 = Math.max(v[0], v[2]);
  const y0 = Math.min(v[1], v[3]);
  const y1 = Math.max(v[1], v[3]);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
