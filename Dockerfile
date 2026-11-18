# ==============================================================================
# Enterprise Multi-Stage Dockerfile for Said Khan Portfolio Backend & CMS
# ==============================================================================

# 1. Base Stage with required system libraries for Prisma and Argon2
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 2. Dependencies Stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# 3. Builder Stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# 4. Production Runner Stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4322

# Run as non-root user for enterprise container security
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 astro

COPY --from=builder --chown=astro:nodejs /app/package.json ./package.json
COPY --from=builder --chown=astro:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=astro:nodejs /app/dist ./dist
COPY --from=builder --chown=astro:nodejs /app/prisma ./prisma
COPY --from=builder --chown=astro:nodejs /app/public ./public

USER astro

EXPOSE 4322

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4322) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/entry.mjs"]
