import * as cheerio from 'cheerio';

const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;

function replaceInText(text: string, data: Record<string, unknown>) {
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const k = key.trim();
    if (!(k in data)) {
      return `{{${k}}}`;
    }
    const v = data[k];
    if (v === null || v === undefined) {
      return '';
    }
    if (typeof v === 'object') {
      return JSON.stringify(v);
    }
    return String(v);
  });
}

export function replacePlaceholdersInHtml(
  html: string,
  data: Record<string, unknown>,
): string {
  const $ = cheerio.load(html);
  const walk = (el: any) => {
    if (!el) {
      return;
    }
    if (el.type === 'text' && typeof el.data === 'string') {
      el.data = replaceInText(el.data, data);
    }
    const ch = el.children || [];
    for (const c of ch) {
      walk(c);
    }
  };
  walk(($ as any).root()[0]);
  return $.root().html() ?? '';
}
