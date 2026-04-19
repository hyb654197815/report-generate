# Report Generate

Monorepo for the system described in `系统报告生成服务.md`: React designer, NestJS API, MySQL, MinIO, Redis, Gotenberg, and PDF composition (pdf-lib; rich text areas are rasterized via Gotenberg’s Chromium screenshot route).

## 与方案文档（`系统报告生成服务.md`）的差异摘要

- **PDF 引擎**：方案示例为 iText/PDFBox；本仓库使用 **pdf-lib** 叠图，文本区域经 **Gotenberg** 栅格化为 PNG 后贴回。
- **多页模板**：数据模型与后端支持 `position.page`；Web 设计器 **仅展示第 1 页**，保存时页码固定为 **1**。
- **设计器富文本**：方案建议在设计阶段用 Quill/Slate；当前设计器静态内容为 **HTML 文本框**（Word 导入路径仍用 Quill）。
- **图表占位图**：组件 seed 含 `placeholderUrl`，设计器 **尚未**用其做 IMAGE 区域预览。
- **脚本沙箱**：有超时与 HTTP 白名单等；执行环境为 **AsyncFunction**，非独立进程/VM 级隔离。
- **组件库 UI**：后端与 seed 提供公共组件；管理端 **无**独立组件库 CRUD 页面（设计器内可关联组件）。

## Prerequisites

- Node.js 20+
- pnpm 10 (`corepack enable`)

## Local development (without Docker)

1. Start MySQL 8, Redis, MinIO, and Gotenberg locally (or use Docker only for those four).
2. Copy `apps/api/.env.example` to `apps/api/.env` and adjust URLs.
3. From repo root:

```bash
pnpm install
cd apps/api && pnpm exec prisma migrate deploy && pnpm exec prisma db seed && cd ../..
pnpm dev
```

- API: `http://localhost:4000`
- Web (Vite): `http://localhost:5173` — proxied to API under `/api`.

## Docker Compose

```bash
docker compose up --build
```

- Web UI: `http://localhost:5173` (nginx proxies `/api` to the API service)
- API: `http://localhost:4000`
- MinIO console: `http://localhost:9001` (user `minio` / password `minio12345`)
- Gotenberg: `http://localhost:3030`

First API start runs `prisma migrate deploy`. Seed sample components once:

```bash
docker compose exec api sh -c "cd /repo/apps/api && pnpm exec prisma db seed"
```

## Example API calls

```bash
curl -s http://localhost:4000/health

curl -s -X POST http://localhost:4000/templates -H 'Content-Type: application/json' -d '{"name":"Demo"}'

# Upload a PDF background (replace @file.pdf)
curl -s -X POST http://localhost:4000/templates/1/background -F file=@file.pdf

# Save elements (normalized coordinates, page 1)
curl -s -X PUT http://localhost:4000/templates/1/elements \
  -H 'Content-Type: application/json' \
  -d '{"elements":[{"elementType":"TEXT","position":{"page":1,"x":0.1,"y":0.1,"w":0.5,"h":0.1},"staticContent":"<p>{{title}}</p>","scriptCode":"async function fetchData(ctx){ return { title: ctx.params.title || \"Hi\" }; }"}]}'

curl -s -X POST http://localhost:4000/reports/generate \
  -H 'Content-Type: application/json' \
  -d '{"templateId":1,"params":{"title":"From curl"}}' \
  --output out.pdf
```

## Tests

```bash
pnpm --filter api test
pnpm --filter api test:e2e
```
