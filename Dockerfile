FROM node:24.18.0-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run db:generate
RUN pnpm run build

FROM node:24.18.0-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/sgms.sqlite
RUN mkdir -p /data
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node apps/api/dist/server.js"]