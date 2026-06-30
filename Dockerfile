# ─────────────────────────────────────────────────────────────────────────────
# Raw Agents — Production Docker Image
#
# Multi-stage build using Bun runtime.
#
# Build:
#   docker build -t zobite/raw-agents:latest .
#
# Run:
#   docker run -d -p 15888:15888 \
#     -v raw-agents-data:/data \
#     zobite/raw-agents:latest
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package manifests first (layer caching for deps)
COPY package.json bun.lock ./
COPY src/server/package.json src/server/
COPY src/web/package.json src/web/

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ src/
COPY biome.json ./

# Build web (Vite) → src/web/dist
RUN cd src/web && bun run build

# Build server (Bun bundle) → src/server/dist/index.js
RUN cd src/server && bun run build

# ── Stage 2: Production ────────────────────────────────────────────────────
FROM oven/bun:1-debian

WORKDIR /app

# Copy built server bundle
COPY --from=builder /app/src/server/dist ./dist

# Copy web UI build
COPY --from=builder /app/src/web/dist ./public

# Copy package manifests and install production deps only
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./
COPY --from=builder /app/src/server/package.json ./src/server/
COPY --from=builder /app/src/web/package.json ./src/web/
RUN bun install --production --frozen-lockfile

# Create data directory
RUN mkdir -p /data

# ── Environment ─────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=15888
ENV DATA_DIR=/data

EXPOSE 15888

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:15888/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Data volume
VOLUME ["/data"]

CMD ["bun", "run", "dist/index.js"]
