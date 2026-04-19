FROM node:20-bookworm-slim AS build
WORKDIR /repo
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter web...
COPY apps/web ./apps/web
WORKDIR /repo/apps/web
RUN pnpm run build

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
