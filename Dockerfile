FROM node:24.18.0-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24.18.0-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json pnpm-workspace.yaml ./
ENV DATABASE_URL=sqlite:./data/sgms.sqlite
EXPOSE 3000
CMD ["node", "dist/apps/web/server.js"]