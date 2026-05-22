# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for linux/alpine
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js app (produces .next/standalone via next.config.ts output:"standalone")
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Public assets
COPY --from=builder /app/public ./public

# Standalone output — self-contained node server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma config + schema — needed for `prisma migrate deploy`
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Full node_modules from builder — Prisma 7 CLI has a deep transitive dep tree
# (effect, c12, giget, jiti, …) that can't be cherry-picked reliably.
# Standalone server.js works fine with a superset of modules.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Expose prisma CLI in PATH (standalone output has no .bin/ symlinks)
RUN ln -sf /app/node_modules/prisma/build/index.js /usr/local/bin/prisma && \
    chmod +x /app/node_modules/prisma/build/index.js

# Startup script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
