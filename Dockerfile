FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
COPY packages/engine/package.json packages/engine/
RUN bun install --frozen-lockfile --production

# Copy source
COPY packages/engine packages/engine
COPY tsconfig.json ./

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["bun", "run", "packages/engine/src/index.ts"]
