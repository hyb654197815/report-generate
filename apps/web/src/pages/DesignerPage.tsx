import {
  ArrowLeftOutlined,
  BlockOutlined,
  DeleteOutlined,
  DownOutlined,
  FileTextOutlined,
  PictureOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Canvas, Rect } from 'fabric';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Dropdown,
  Empty,
  Flex,
  Form,
  Input,
  List,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HtmlQuillEditor } from '../components/HtmlQuillEditor';
import { ScriptDebugPanel } from '../components/ScriptDebugPanel';
import { api } from '../api';
import { defaultChartBarScript, defaultChartRadarScript } from '../lib/chart-script-templates';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PDF_SCALE = 1.25;

/** 与后端 `POSITION_PPM` 一致：整数 0..1e6 表示占可视区域宽/高的比例（避免 JSON 浮点误差）。 */
const POSITION_PPM = 1_000_000;

type Position = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  xp?: number;
  yp?: number;
  wp?: number;
  hp?: number;
};

function toPpm(frac: number): number {
  return Math.round(Math.min(1, Math.max(0, frac)) * POSITION_PPM);
}


function resolvedPositionFractions(norm: Position): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const D = POSITION_PPM;
  const clamp = (u: number) => Math.min(1, Math.max(0, u / D));
  if (
    norm.xp !== undefined &&
    norm.yp !== undefined &&
    norm.wp !== undefined &&
    norm.hp !== undefined
  ) {
    return {
      x: clamp(norm.xp),
      y: clamp(norm.yp),
      w: clamp(norm.wp),
      h: clamp(norm.hp),
    };
  }
  return {
    x: Math.min(1, Math.max(0, norm.x)),
    y: Math.min(1, Math.max(0, norm.y)),
    w: Math.min(1, Math.max(0, norm.w)),
    h: Math.min(1, Math.max(0, norm.h)),
  };
}

type TemplateElement = {
  id: number;
  elementType: string;
  positionJson: string;
  scriptCode: string | null;
  staticContent: string | null;
  componentId: number | null;
};

type SysComponent = {
  id: number;
  name: string;
  type: string;
  defaultScript: string | null;
  defaultConfig: string | null;
};

type Meta = {
  localKey: string;
  page: number;
  elementType: 'TEXT' | 'IMAGE' | 'CHART';
  scriptCode: string;
  staticContent: string;
  componentId: number | null;
};

type StoredRect = { norm: Position; meta: Meta };

const DEFAULT_TEXT_SCRIPT = `async function fetchData(context) {
  const { params } = context;
  return { title: params.title || '示例标题', body: '这是一段示例正文。' };
}`;

const DEFAULT_IMAGE_SCRIPT = `async function generateChart(context) {
  return '';
}`;

function parseMeta(raw: unknown, defaultPage = 1): Meta {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<Meta>;
    const page = typeof r.page === 'number' && r.page >= 1 ? r.page : defaultPage;
    return {
      localKey:
        typeof r.localKey === 'string' && r.localKey.length > 0
          ? r.localKey
          : crypto.randomUUID(),
      page,
      elementType: r.elementType === 'IMAGE' || r.elementType === 'CHART' ? r.elementType : 'TEXT',
      scriptCode: r.scriptCode ?? '',
      staticContent: r.staticContent ?? '',
      componentId: r.componentId ?? null,
    };
  }
  return {
    localKey: crypto.randomUUID(),
    page: defaultPage,
    elementType: 'TEXT',
    scriptCode: DEFAULT_TEXT_SCRIPT,
    staticContent: '<p>文本 {{title}}</p>',
    componentId: null,
  };
}

function applyComponentDefaults(comp: SysComponent): Pick<Meta, 'elementType' | 'scriptCode' | 'staticContent'> {
  const elementType = comp.type === 'IMAGE' || comp.type === 'CHART' ? comp.type : 'TEXT';
  let scriptCode = comp.defaultScript?.trim() ? comp.defaultScript : '';
  let staticContent = '';
  if (comp.defaultConfig?.trim()) {
    try {
      const cfg = JSON.parse(comp.defaultConfig) as {
        richHtml?: string;
        placeholderUrl?: string;
      };
      if (elementType === 'TEXT' && cfg.richHtml) {
        staticContent = cfg.richHtml;
      }
      if (elementType === 'IMAGE' && cfg.placeholderUrl) {
        staticContent = cfg.placeholderUrl;
      }
    } catch {
      /* ignore */
    }
  }
  if (!staticContent) {
    staticContent =
      elementType === 'TEXT'
        ? '<p>文本 {{title}}</p>'
        : elementType === 'IMAGE'
          ? 'https://via.placeholder.com/400x200.png'
          : '{}';
  }
  if (!scriptCode) {
    scriptCode =
      elementType === 'TEXT'
        ? DEFAULT_TEXT_SCRIPT
        : elementType === 'IMAGE'
          ? DEFAULT_IMAGE_SCRIPT
          : defaultChartBarScript;
  }
  return { elementType, scriptCode, staticContent };
}

function hydratePageStore(elements: TemplateElement[]): Map<number, StoredRect[]> {
  const m = new Map<number, StoredRect[]>();
  for (const el of elements) {
    const pos = JSON.parse(el.positionJson) as Position;
    const pn = pos.page >= 1 ? pos.page : 1;
    const meta: Meta = {
      localKey: `srv-${el.id}`,
      page: pn,
      elementType: el.elementType === 'IMAGE' ? 'IMAGE' : 'TEXT',
      scriptCode: el.scriptCode ?? '',
      staticContent: el.staticContent ?? '',
      componentId: el.componentId,
    };
    const norm: Position = { ...pos, page: pn };
    if (!m.has(pn)) {
      m.set(pn, []);
    }
    m.get(pn)!.push({ norm, meta });
  }
  return m;
}


/**
 * Persist rects using simple percentage of canvas (0-1 range).
 * This is relative to the rendered page, which matches the user's visual expectation.
 */
function flushCanvasToPageStore(
  canvas: Canvas,
  page: number,
  store: Map<number, StoredRect[]>,
): void {
  const cw = canvas.getWidth();
  const ch = canvas.getHeight();
  if (cw <= 0 || ch <= 0) {
    return;
  }
  // Always use canvas percentage - this is what the user sees
  // Backend will use the same percentage against PDF page size
  const snaps: StoredRect[] = [];
  for (const o of canvas.getObjects()) {
    if (!(o instanceof Rect)) {
      continue;
    }
    const m0 = parseMeta((o as unknown as { elementMeta?: Meta }).elementMeta, page);
    const meta: Meta = { ...m0, page };
    /** Geometry box only — must match how we restore via left/top/width/height (excludes stroke halo). */
    const left = o.left ?? 0;
    const top = o.top ?? 0;
    const w = (o.getScaledWidth?.() ?? o.width ?? 0) as number;
    const h = (o.getScaledHeight?.() ?? o.height ?? 0) as number;
    // Simple percentage of canvas - x from left, y from top (canvas coordinates)
    const fx = left / cw;
    const fy = top / ch;
    const fw = w / cw;
    const fh = h / ch;
    snaps.push({
      meta,
      norm: {
        page,
        x: fx,
        y: fy,
        w: fw,
        h: fh,
        xp: toPpm(fx),
        yp: toPpm(fy),
        wp: toPpm(fw),
        hp: toPpm(fh),
      },
    });
  }
  store.set(page, snaps);
}

function normRectToFabricRect(
  norm: Position,
  canvasWidth: number,
  canvasHeight: number,
): { left: number; top: number; width: number; height: number } {
  const fr = resolvedPositionFractions(norm);
  // Simple percentage of canvas - matches flushCanvasToPageStore
  return {
    left: fr.x * canvasWidth,
    top: fr.y * canvasHeight,
    width: fr.w * canvasWidth,
    height: fr.h * canvasHeight,
  };
}

function countRegionsInStore(store: Map<number, StoredRect[]>): number {
  let n = 0;
  for (const list of store.values()) {
    n += list.length;
  }
  return n;
}

type ElementRow = { localKey: string; title: string };

export function DesignerPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const templateId = Number(id);
  const qc = useQueryClient();

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  /** Cached pdf.js pages for coordinate sync (same instance as last render). */
  const pdfPageCacheRef = useRef<Map<number, pdfjsLib.PDFPageProxy>>(new Map());
  const pageStoreRef = useRef<Map<number, StoredRect[]>>(new Map());
  const currentPageRef = useRef(1);
  const layoutRef = useRef<{ page: number; w: number; h: number } | null>(null);

  /** PDF page + viewport size updated together after render (avoids fabric using wrong dimensions when switching pages). */
  const [layout, setLayout] = useState<{ page: number; w: number; h: number } | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [drawMode, setDrawMode] = useState(false);
  const drawModeRef = useRef(drawMode);
  const [selected, setSelected] = useState<Rect | null>(null);
  const selectedFabricRef = useRef<Rect | null>(null);
  const [meta, setMeta] = useState<Meta>(parseMeta(null, 1));
  const [elementRows, setElementRows] = useState<ElementRow[]>([]);
  const [totalRegions, setTotalRegions] = useState(0);
  const [richEditorSession, setRichEditorSession] = useState(0);
  const dragRef = useRef<{ active: boolean; x: number; y: number; rect?: Rect }>({
    active: false,
    x: 0,
    y: 0,
  });

  const templateQ = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      const res = await api.get(`/templates/${templateId}`);
      return res.data as {
        id: number;
        backgroundPdfUrl: string | null;
        elements: TemplateElement[];
      };
    },
    enabled: Number.isFinite(templateId),
  });

  const componentsQ = useQuery({
    queryKey: ['components'],
    queryFn: async () => {
      const res = await api.get<SysComponent[]>('/components');
      return res.data;
    },
  });

  const templateFingerprint = useMemo(
    () =>
      JSON.stringify(
        (templateQ.data?.elements ?? []).map((e) => ({
          id: e.id,
          positionJson: e.positionJson,
          elementType: e.elementType,
          scriptCode: e.scriptCode,
          staticContent: e.staticContent,
          componentId: e.componentId,
        })),
      ),
    [templateQ.data?.elements],
  );

  useEffect(() => {
    const els = templateQ.data?.elements;
    pageStoreRef.current = hydratePageStore(els ?? []);
    setTotalRegions(countRegionsInStore(pageStoreRef.current));
  }, [templateFingerprint]);

  const refreshElementRows = useCallback(() => {
    const canvas = fabricRef.current;
    if (canvas) {
      const pn = layout?.page ?? currentPage;
      flushCanvasToPageStore(canvas, pn, pageStoreRef.current);
    }
    if (!canvas) {
      setElementRows([]);
      setTotalRegions(countRegionsInStore(pageStoreRef.current));
      return;
    }
    const comps = componentsQ.data;
    const rows: ElementRow[] = [];
    let i = 0;
    for (const o of canvas.getObjects()) {
      if (!(o instanceof Rect)) {
        continue;
      }
      i += 1;
      const m = parseMeta((o as unknown as { elementMeta?: Meta }).elementMeta, layout?.page ?? currentPage);
      const comp = m.componentId != null ? comps?.find((c) => c.id === m.componentId) : undefined;
      rows.push({
        localKey: m.localKey,
        title: `第 ${m.page} 页 · ${m.elementType} #${i}${comp ? ` · ${comp.name}` : ''}`,
      });
    }
    setElementRows(rows);
    setTotalRegions(countRegionsInStore(pageStoreRef.current));
  }, [componentsQ.data, currentPage, layout?.page]);

  const refreshElementRowsRef = useRef(refreshElementRows);
  useEffect(() => {
    refreshElementRowsRef.current = refreshElementRows;
  }, [refreshElementRows]);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    selectedFabricRef.current = selected;
  }, [selected]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!templateQ.data?.backgroundPdfUrl || !pdfCanvasRef.current) {
        return;
      }
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
      pdfPageCacheRef.current.clear();
      setNumPages(0);
      setLayout(null);
      const res = await api.get(`/templates/${templateId}/background-file`, {
        responseType: 'arraybuffer',
      });
      if (cancelled) {
        return;
      }
      const pdf = await pdfjsLib.getDocument({ data: res.data }).promise;
      if (cancelled) {
        await pdf.destroy();
        return;
      }
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setCurrentPage(1);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, templateQ.data?.backgroundPdfUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdf = pdfDocRef.current;
      const canvasEl = pdfCanvasRef.current;
      if (!pdf || !canvasEl || !numPages || currentPage < 1 || currentPage > numPages) {
        return;
      }
      const page = await pdf.getPage(currentPage);
      pdfPageCacheRef.current.set(currentPage, page);
      const viewport = page.getViewport({ scale: PDF_SCALE });
      const canvas = canvasEl;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const task = page.render({ canvas, viewport });
      await task.promise;
      if (!cancelled) {
        setLayout({
          page: currentPage,
          w: viewport.width,
          h: viewport.height,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, numPages, templateId]);

  useEffect(() => {
    if (!fabricElRef.current || !layout || layout.w === 0) {
      return;
    }
    const { w: lw, h: lh, page: layoutPage } = layout;
    const fabricHost = fabricElRef.current;
    fabricRef.current?.dispose();
    fabricRef.current = null;
    let cancelled = false;

    (async () => {
      const pdf = pdfDocRef.current;
      if (!pdf) {
        return;
      }
      let pdfPage = pdfPageCacheRef.current.get(layoutPage);
      if (!pdfPage) {
        pdfPage = await pdf.getPage(layoutPage);
        if (cancelled) {
          return;
        }
        pdfPageCacheRef.current.set(layoutPage, pdfPage);
      }
      const vp = pdfPage.getViewport({ scale: PDF_SCALE });
      if (cancelled) {
        return;
      }
      if (Math.abs(vp.width - lw) > 1 || Math.abs(vp.height - lh) > 1) {
        return;
      }

      const canvas = new Canvas(fabricHost, {
        width: lw,
        height: lh,
        selection: true,
        /** Match PDF.js canvas 1:1 so normalized rects align with backend pdf-lib placement. */
        enableRetinaScaling: false,
      });

    const syncMetaFromObject = (obj: Rect | undefined) => {
      if (!obj) {
        setSelected(null);
        return;
      }
      setSelected(obj);
      setMeta(parseMeta((obj as unknown as { elementMeta?: Meta }).elementMeta, layoutPage));
    };

    canvas.on('selection:created', (e) => {
      const t = e.selected?.[0];
      if (t instanceof Rect) {
        syncMetaFromObject(t);
      }
    });
    canvas.on('selection:updated', (e) => {
      const t = e.selected?.[0];
      if (t instanceof Rect) {
        syncMetaFromObject(t);
      }
    });
    canvas.on('selection:cleared', () => syncMetaFromObject(undefined));

    canvas.on('mouse:down', (opt) => {
      if (!drawModeRef.current) {
        return;
      }
      if (opt.target) {
        return;
      }
      const p = canvas.getScenePoint(opt.e);
      dragRef.current = { active: true, x: p.x, y: p.y };
      const r = new Rect({
        left: p.x,
        top: p.y,
        width: 0,
        height: 0,
        fill: 'rgba(22, 119, 255, 0.12)',
        stroke: '#1677ff',
        strokeWidth: 1,
        selectable: true,
        originX: 'left',
        originY: 'top',
      });
      (r as unknown as { elementMeta: Meta }).elementMeta = parseMeta(null, layoutPage);
      dragRef.current.rect = r;
      canvas.add(r);
    });

    canvas.on('mouse:move', (opt) => {
      if (!drawModeRef.current || !dragRef.current.active || !dragRef.current.rect) {
        return;
      }
      const p = canvas.getScenePoint(opt.e);
      const { x, y } = dragRef.current;
      const left = Math.min(x, p.x);
      const top = Math.min(y, p.y);
      const width = Math.abs(p.x - x);
      const height = Math.abs(p.y - y);
      dragRef.current.rect.set({ left, top, width, height });
      canvas.requestRenderAll();
    });

    canvas.on('mouse:up', () => {
      if (!drawModeRef.current) {
        dragRef.current.active = false;
        dragRef.current.rect = undefined;
        return;
      }
      const wasDrawing = dragRef.current.active;
      const r = dragRef.current.rect;
      dragRef.current.active = false;
      dragRef.current.rect = undefined;
      if (!wasDrawing || !r) {
        return;
      }
      const w = (r.getScaledWidth?.() ?? r.width ?? 0) as number;
      const h = (r.getScaledHeight?.() ?? r.height ?? 0) as number;
      if (w < 4 || h < 4) {
        canvas.remove(r);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        refreshElementRowsRef.current();
        return;
      }
      canvas.selection = true;
      canvas.setActiveObject(r);
      canvas.requestRenderAll();
      syncMetaFromObject(r);
      setDrawMode(false);
      refreshElementRowsRef.current();
    });

    canvas.on('object:added', () => refreshElementRowsRef.current());
    canvas.on('object:removed', () => refreshElementRowsRef.current());

    const list = pageStoreRef.current.get(layoutPage) ?? [];
    for (const snap of list) {
      const { left, top, width, height } = normRectToFabricRect(snap.norm, lw, lh);
      const r = new Rect({
        left,
        top,
        width,
        height,
        fill: 'rgba(82, 196, 26, 0.1)',
        stroke: '#52c41a',
        strokeWidth: 1,
        originX: 'left',
        originY: 'top',
      });
      (r as unknown as { elementMeta: Meta }).elementMeta = { ...snap.meta, page: layoutPage };
      canvas.add(r);
    }

    refreshElementRowsRef.current();

    if (cancelled) {
      canvas.dispose();
      return;
    }
    fabricRef.current = canvas;
    })();

    return () => {
      cancelled = true;
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [layout, templateFingerprint]);

  useEffect(() => {
    refreshElementRows();
  }, [refreshElementRows]);

  useEffect(() => {
    const c = fabricRef.current;
    if (!c) {
      return;
    }
    c.selection = !drawMode;
    c.defaultCursor = drawMode ? 'crosshair' : 'default';
  }, [drawMode]);

  useEffect(() => {
    const rect = selectedFabricRef.current;
    if (!rect) {
      return;
    }
    (rect as unknown as { elementMeta: Meta }).elementMeta = {
      ...meta,
      page: layout?.page ?? currentPage,
    };
  }, [meta, currentPage, layout?.page]);

  const goToPage = (next: number) => {
    if (!fabricRef.current || next < 1 || !numPages || next > numPages || next === currentPage) {
      return;
    }
    flushCanvasToPageStore(
      fabricRef.current,
      currentPage,
      pageStoreRef.current,
    );
    setTotalRegions(countRegionsInStore(pageStoreRef.current));
    setSelected(null);
    setLayout(null);
    setCurrentPage(next);
  };

  const findRectByLocalKey = (key: string): Rect | null => {
    const c = fabricRef.current;
    if (!c) {
      return null;
    }
    for (const o of c.getObjects()) {
      if (!(o instanceof Rect)) {
        continue;
      }
      const m = parseMeta((o as unknown as { elementMeta?: Meta }).elementMeta, layout?.page ?? currentPage);
      if (m.localKey === key) {
        return o;
      }
    }
    return null;
  };

  const deleteSelected = useCallback(() => {
    const c = fabricRef.current;
    const r = selectedFabricRef.current;
    if (!c || !r) {
      return;
    }
    c.remove(r);
    c.discardActiveObject();
    c.requestRenderAll();
    setSelected(null);
    const pn = layoutRef.current?.page ?? currentPageRef.current;
    flushCanvasToPageStore(c, pn, pageStoreRef.current);
    setTotalRegions(countRegionsInStore(pageStoreRef.current));
    refreshElementRows();
  }, [refreshElementRows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') {
        return;
      }
      const t = e.target as HTMLElement | null;
      if (
        t?.closest('.monaco-editor') ||
        t?.closest('.ant-input') ||
        t?.closest('input') ||
        t?.closest('textarea')
      ) {
        return;
      }
      if (drawModeRef.current) {
        return;
      }
      if (!selectedFabricRef.current) {
        return;
      }
      e.preventDefault();
      const c = fabricRef.current;
      const r = selectedFabricRef.current;
      if (!c || !r) {
        return;
      }
      c.remove(r);
      c.discardActiveObject();
      c.requestRenderAll();
      setSelected(null);
      const pn = layoutRef.current?.page ?? currentPageRef.current;
      flushCanvasToPageStore(c, pn, pageStoreRef.current);
      setTotalRegions(countRegionsInStore(pageStoreRef.current));
      refreshElementRows();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refreshElementRows]);

  const save = useMutation({
    mutationFn: async () => {
      const canvas = fabricRef.current;
      if (canvas) {
        const pn = layoutRef.current?.page ?? currentPageRef.current;
        flushCanvasToPageStore(canvas, pn, pageStoreRef.current);
      }
      const store = pageStoreRef.current;
      const pages = [...store.keys()].sort((a, b) => a - b);
      const pdf = pdfDocRef.current;
      const elements: {
        elementType: string;
        position: Position;
        scriptCode?: string;
        staticContent?: string;
        componentId?: number;
      }[] = [];
      for (const p of pages) {
        let pdfPage = pdfPageCacheRef.current.get(p);
        if (pdf && !pdfPage) {
          pdfPage = await pdf.getPage(p);
          pdfPageCacheRef.current.set(p, pdfPage);
        }
        for (const snap of store.get(p) ?? []) {
          elements.push({
            elementType: snap.meta.elementType,
            position: {
              page: snap.norm.page,
              x: snap.norm.x,
              y: snap.norm.y,
              w: snap.norm.w,
              h: snap.norm.h,
              xp: snap.norm.xp,
              yp: snap.norm.yp,
              wp: snap.norm.wp,
              hp: snap.norm.hp,
            },
            scriptCode: snap.meta.scriptCode || undefined,
            staticContent: snap.meta.staticContent || undefined,
            componentId: snap.meta.componentId ?? undefined,
          });
        }
      }
      await api.put(`/templates/${templateId}/elements`, { elements });
    },
    onSuccess: async () => {
      message.success('元素已保存');
      await qc.invalidateQueries({ queryKey: ['template', templateId] });
    },
    onError: () => {
      message.error('保存失败');
    },
  });

  const addPresetElement = (t: 'TEXT' | 'IMAGE' | 'CHART') => {
    const canvas = fabricRef.current;
    if (!canvas || !layout || layout.w === 0) {
      return;
    }
    const w = Math.min(320, layout.w * 0.38);
    const h = t === 'TEXT' ? Math.min(120, layout.h * 0.14) : Math.min(200, layout.h * 0.24);
    const left = (layout.w - w) / 2;
    const top = (layout.h - h) / 2;
    const base = parseMeta(null, layout.page);
    const nextMeta: Meta = {
      ...base,
      elementType: t,
      scriptCode:
        t === 'TEXT' ? DEFAULT_TEXT_SCRIPT : t === 'IMAGE' ? DEFAULT_IMAGE_SCRIPT : defaultChartBarScript,
      staticContent:
        t === 'TEXT'
          ? '<p><strong>{{title}}</strong></p><p>{{body}}</p>'
          : t === 'IMAGE'
            ? 'https://via.placeholder.com/400x200.png?text=IMAGE'
            : '{}',
    };
    const r = new Rect({
      left,
      top,
      width: w,
      height: h,
      fill: 'rgba(114, 46, 209, 0.1)',
      stroke: '#722ed1',
      strokeWidth: 1,
      originX: 'left',
      originY: 'top',
    });
    (r as unknown as { elementMeta: Meta }).elementMeta = nextMeta;
    canvas.add(r);
    canvas.selection = true;
    canvas.setActiveObject(r);
    canvas.requestRenderAll();
    setDrawMode(false);
    setSelected(r);
    setMeta(nextMeta);
    flushCanvasToPageStore(canvas, layout.page, pageStoreRef.current);
    setTotalRegions(countRegionsInStore(pageStoreRef.current));
    refreshElementRows();
  };

  const reloadDefaultsFromLinkedComponent = () => {
    if (meta.componentId == null) {
      message.info('请先关联公共组件');
      return;
    }
    const comp = componentsQ.data?.find((c) => c.id === meta.componentId);
    if (!comp) {
      message.warning('组件列表尚未加载或组件不存在');
      return;
    }
    const d = applyComponentDefaults(comp);
    setMeta((m) => ({
      ...m,
      elementType: d.elementType,
      scriptCode: d.scriptCode,
      staticContent: d.staticContent,
    }));
    setRichEditorSession((s) => s + 1);
    message.success('已载入该公共组件的默认脚本与配置');
  };

  if (!Number.isFinite(templateId)) {
    return <Result status="404" title="无效的模板 ID" />;
  }
  if (templateQ.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" tip="加载模板…" />
      </div>
    );
  }
  if (templateQ.isError || !templateQ.data?.backgroundPdfUrl) {
    return (
      <Result
        status="warning"
        title="无法打开设计器"
        subTitle="模板不存在或尚未上传底图 PDF。"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回模板列表
          </Button>
        }
      />
    );
  }

  return (
    <Flex vertical gap={16}>
      <Card styles={{ body: { padding: '16px 20px' } }}>
        <Flex justify="space-between" align="flex-start" gap={16} wrap>
          <Flex align="center" gap={12} wrap>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/templates/${templateId}`)}>
              返回
            </Button>
            <Divider type="vertical" style={{ height: 28, margin: 0 }} />
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                模板设计器
              </Typography.Title>
              <Typography.Text type="secondary">#{templateId}</Typography.Text>
            </div>
          </Flex>

          <Flex align="center" gap={10} wrap>
            {numPages > 1 && (
              <Space.Compact>
                <Button disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
                  上一页
                </Button>
                <Button disabled style={{ minWidth: 100, color: 'inherit' }}>
                  {currentPage} / {numPages}
                </Button>
                <Button disabled={currentPage >= numPages} onClick={() => goToPage(currentPage + 1)}>
                  下一页
                </Button>
              </Space.Compact>
            )}

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'text',
                    icon: <FileTextOutlined />,
                    label: '文本区域',
                    onClick: () => addPresetElement('TEXT'),
                  },
                  {
                    key: 'img',
                    icon: <PictureOutlined />,
                    label: '图片区域',
                    onClick: () => addPresetElement('IMAGE'),
                  },
                  {
                    key: 'chart',
                    icon: <PictureOutlined />,
                    label: '图表区域',
                    onClick: () => addPresetElement('CHART'),
                  },
                ],
              }}
            >
              <Button type="primary" icon={<DownOutlined />}>
                添加元素
              </Button>
            </Dropdown>

            <Link to="/components">
              <Button icon={<BlockOutlined />}>公共组件库</Button>
            </Link>
            <Link to="/settings/ai">
              <Button type="default">大模型设置</Button>
            </Link>

            <Flex align="center" gap={8} style={{ paddingLeft: 4 }}>
              <Typography.Text type="secondary">绘制</Typography.Text>
              <Switch checked={drawMode} onChange={setDrawMode} />
            </Flex>

            <Button danger icon={<DeleteOutlined />} disabled={!selected} onClick={() => deleteSelected()}>
              删除
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={save.isPending}
              disabled={!layout}
              onClick={() => save.mutate()}
            >
              保存
            </Button>
          </Flex>
        </Flex>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={15}>
          <Card
            title={
              <Flex align="center" gap={8} wrap>
                <span>画布</span>
                <Tag color="blue">第 {numPages ? currentPage : '—'} 页</Tag>
                <Typography.Text type="secondary">
                  本页 {elementRows.length} 个区域 · 全稿共 {totalRegions} 个
                </Typography.Text>
              </Flex>
            }
            styles={{ body: { padding: 20, overflow: 'auto' } }}
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
              切换页面前会自动保存当前页矩形到内存；点「保存」写入数据库。位置以当前页可视区域为基准，并用整数万分比（0–1e6）+ view 快照写入，减少浮点误差。
            </Typography.Paragraph>
            <div
              style={{
                position: 'relative',
                width: layout?.w ?? 0,
                height: layout?.h ?? 0,
                margin: '0 auto',
                minHeight: layout ? undefined : 120,
              }}
            >
              <canvas
                ref={pdfCanvasRef}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 8 }}
              />
              <canvas
                ref={fabricElRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  cursor: drawMode ? 'crosshair' : 'default',
                  borderRadius: 8,
                }}
              />
            </div>
            {elementRows.length > 0 && (
              <List
                size="small"
                bordered
                style={{ marginTop: 16, maxWidth: 560 }}
                header={<Typography.Text strong>本页区域</Typography.Text>}
                dataSource={elementRows}
                renderItem={(item) => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const r = findRectByLocalKey(item.localKey);
                      const c = fabricRef.current;
                      if (r && c) {
                        c.selection = true;
                        c.setActiveObject(r);
                        c.requestRenderAll();
                        setSelected(r);
                        setMeta(
                          parseMeta((r as unknown as { elementMeta?: Meta }).elementMeta, layout?.page ?? currentPage),
                        );
                      }
                    }}
                  >
                    {item.title}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card
            title="元素属性"
            styles={{ body: { padding: 16 } }}
            variant="borderless"
            style={{ background: 'var(--ant-color-fill-quaternary, #fafafa)', borderRadius: 12 }}
          >
            {!selected && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="在画布上选择矩形，或使用「添加元素」"
                styles={{ image: { height: 56 } }}
              />
            )}
            {selected && (
              <Tabs
                size="middle"
                tabBarStyle={{ marginBottom: 0 }}
                items={[
                  {
                    key: 'basic',
                    label: '基础',
                    forceRender: true,
                    children: (
                      <div style={{ paddingTop: 12 }}>
                        <Form layout="vertical" requiredMark="optional">
                          <Form.Item label="类型">
                            <Select
                              value={meta.elementType}
                              onChange={(v) => {
                                setMeta((m) => ({
                                  ...m,
                                  elementType: v,
                                  staticContent:
                                    v === 'TEXT' && m.elementType === 'IMAGE'
                                      ? '<p><strong>{{title}}</strong></p><p>{{body}}</p>'
                                      : m.staticContent,
                                }));
                                if (v === 'TEXT') {
                                  setRichEditorSession((s) => s + 1);
                                }
                              }}
                              options={[
                                { value: 'TEXT', label: 'TEXT · 富文本 + fetchData' },
                                { value: 'IMAGE', label: 'IMAGE · generateChart' },
                                { value: 'CHART', label: 'CHART · generateChartOption' },
                              ]}
                            />
                          </Form.Item>
                          <Form.Item label="关联公共组件">
                            <Select
                              allowClear
                              placeholder="不关联则仅用私有脚本 / HTML"
                              value={meta.componentId ?? undefined}
                              onChange={(v) => {
                                if (v == null) {
                                  setMeta((m) => ({ ...m, componentId: null }));
                                  return;
                                }
                                const comp = componentsQ.data?.find((x) => x.id === Number(v));
                                if (!comp) {
                                  setMeta((m) => ({ ...m, componentId: Number(v) }));
                                  return;
                                }
                                const d = applyComponentDefaults(comp);
                                setMeta((m) => ({
                                  ...m,
                                  componentId: comp.id,
                                  elementType: d.elementType,
                                  scriptCode: d.scriptCode,
                                  staticContent: d.staticContent,
                                }));
                                setRichEditorSession((s) => s + 1);
                              }}
                              options={componentsQ.data?.map((c) => ({
                                value: c.id,
                                label: `${c.name}（${c.type}）`,
                              }))}
                            />
                          </Form.Item>
                          <Button block type="default" onClick={() => reloadDefaultsFromLinkedComponent()}>
                            重新载入公共组件默认值
                          </Button>
                          <Descriptions column={1} size="small" style={{ marginTop: 16 }} bordered>
                            <Descriptions.Item label="所属页码">{meta.page}</Descriptions.Item>
                            <Descriptions.Item label="说明">
                              元素脚本为空时，后端使用公共组件 defaultScript / defaultConfig。
                            </Descriptions.Item>
                          </Descriptions>
                        </Form>
                      </div>
                    ),
                  },
                  {
                    key: 'html',
                    label: meta.elementType === 'TEXT' ? '富文本' : meta.elementType === 'IMAGE' ? '占位图' : '图表配置',
                    forceRender: true,
                    children: (
                      <div style={{ paddingTop: 12 }}>
                        {meta.elementType === 'TEXT' ? (
                          <>
                            <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                              使用工具栏设置样式；占位符 <Typography.Text code>{'{{变量名}}'}</Typography.Text> 需与{' '}
                              <Typography.Text code>fetchData</Typography.Text> 返回字段一致。
                            </Typography.Paragraph>
                            <div
                              style={{
                                border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                                borderRadius: 8,
                                overflow: 'hidden',
                                background: '#fff',
                              }}
                            >
                              <HtmlQuillEditor
                                instanceKey={`${meta.localKey}-${richEditorSession}`}
                                initialHtml={meta.staticContent}
                                minHeight={280}
                                onHtmlChange={(html) => setMeta((m) => ({ ...m, staticContent: html }))}
                              />
                            </div>
                          </>
                        ) : meta.elementType === 'IMAGE' ? (
                          <>
                            <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                              设计预览用占位图 URL（与公共组件里 placeholderUrl 含义相同）。
                            </Typography.Paragraph>
                            <Input.TextArea
                              rows={6}
                              value={meta.staticContent}
                              onChange={(e) => setMeta((m) => ({ ...m, staticContent: e.target.value }))}
                              style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 13 }}
                            />
                          </>
                        ) : (
                          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                            CHART 类型通过脚本返回 ECharts Option，此处无需额外静态内容。
                          </Typography.Paragraph>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'script',
                    label: '脚本',
                    forceRender: true,
                    children: (
                      <div style={{ paddingTop: 12 }}>
                        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 8 }}>
                          TEXT：<Typography.Text code>fetchData</Typography.Text> · IMAGE：{' '}
                          <Typography.Text code>generateChart</Typography.Text> · CHART：{' '}
                          <Typography.Text code>generateChartOption</Typography.Text>
                        </Typography.Paragraph>
                        {meta.elementType === 'CHART' ? (
                          <Space style={{ marginBottom: 8 }}>
                            <Button
                              size="small"
                              onClick={() => setMeta((m) => ({ ...m, scriptCode: defaultChartBarScript }))}
                            >
                              使用柱状图模板
                            </Button>
                            <Button
                              size="small"
                              onClick={() => setMeta((m) => ({ ...m, scriptCode: defaultChartRadarScript }))}
                            >
                              使用雷达图模板
                            </Button>
                          </Space>
                        ) : null}
                        <div
                          style={{
                            border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                            borderRadius: 8,
                            overflow: 'hidden',
                          }}
                        >
                          <Editor
                            height="320px"
                            defaultLanguage="javascript"
                            path={`el-${meta.localKey}.js`}
                            value={meta.scriptCode}
                            onChange={(v) => setMeta((m) => ({ ...m, scriptCode: v ?? '' }))}
                            options={{
                              minimap: { enabled: false },
                              wordWrap: 'on',
                              fontSize: 13,
                              scrollBeyondLastLine: false,
                            }}
                          />
                        </div>
                        <ScriptDebugPanel
                          key={`dbg-${meta.localKey}`}
                          elementType={meta.elementType}
                          script={meta.scriptCode}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
