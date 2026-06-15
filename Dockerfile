FROM oven/bun:1.3.11 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.11 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.3.11 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_STORE=sqlite
ENV SQLITE_DB_PATH=/app/data/deliveries.sqlite
ENV PORT=3000
RUN mkdir -p /app/data
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "./node_modules/next/dist/bin/next", "start"]
