import type { PDFPage } from 'pdf-lib';
import type { PdfRect } from './pdf-view-rect';

/** 1e6 = 100% ; integer parts avoid JSON float drift ("百分比"精度). */
export const POSITION_PPM = 1_000_000;

export type NormRect = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Integer 0..POSITION_PPM — fraction of view width/height (preferred when present). */
  xp?: number;
  yp?: number;
  wp?: number;
  hp?: number;
};

export function resolvedPositionFractions(rect: NormRect): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const D = POSITION_PPM;
  const clampFrac = (u: number) => Math.min(1, Math.max(0, u / D));
  if (
    rect.xp !== undefined &&
    rect.yp !== undefined &&
    rect.wp !== undefined &&
    rect.hp !== undefined
  ) {
    return {
      x: clampFrac(rect.xp),
      y: clampFrac(rect.yp),
      w: clampFrac(rect.wp),
      h: clampFrac(rect.hp),
    };
  }
  return {
    x: Math.min(1, Math.max(0, rect.x)),
    y: Math.min(1, Math.max(0, rect.y)),
    w: Math.min(1, Math.max(0, rect.w)),
    h: Math.min(1, Math.max(0, rect.h)),
  };
}

/**
 * Convert normalized percentage rect to pdf-lib coordinates.
 * Uses the page's visible size (MediaBox/CropBox intersection).
 * Percentages are relative to the visible page area:
 * - x: 0 = left edge, 1 = right edge
 * - y: 0 = top edge, 1 = bottom edge (canvas-style, flipped for PDF)
 * - w/h: percentage of page width/height
 */
export function normRectToPdfLib(rect: NormRect, view: PdfRect) {
  const f = resolvedPositionFractions(rect);
  const { x: x0, y: y0, width: vw, height: vh } = view;
  // Apply percentages
  const x = x0 + f.x * vw;
  const w = f.w * vw;
  const h = f.h * vh;
  // y in PDF goes up from bottom, but input y is from top (canvas-style)
  const yPdf = y0 + (1 - f.y - f.h) * vh;
  return { x, y: yPdf, width: w, height: h };
}
