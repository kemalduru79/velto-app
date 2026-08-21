# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npm run build

FROM deps AS worker
ENV NODE_ENV=production
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV VELTO_QUEUE_POLL_MS=2000
ENV VELTO_QUEUE_LEASE_SECONDS=60
ENV VELTO_QUEUE_HEARTBEAT_MS=15000
ENV VELTO_WORKER_HEARTBEAT_MS=15000
ENV VELTO_QUEUE_RETRY_BASE_SECONDS=5
ENV VELTO_QUEUE_RETRY_MAX_SECONDS=300
COPY scripts/validate-runtime-env.mjs ./scripts/validate-runtime-env.mjs
COPY scripts/scale-worker.mjs ./scripts/scale-worker.mjs
COPY lib/worker ./lib/worker
USER node
STOPSIGNAL SIGTERM
CMD ["sh", "-c", "node scripts/validate-runtime-env.mjs worker && exec node scripts/scale-worker.mjs"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TMPDIR=/tmp
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-runtime-env.mjs ./scripts/validate-runtime-env.mjs

# ffprobe-static 3.1.0 does not ship every Linux architecture it resolves.
# Keep the package binary where available and install the Debian fallback only
# when the traced package has no executable for the image architecture.
RUN FFPROBE_PATH="$(node -p "require('ffprobe-static').path")" \
    && if [ ! -x "$FFPROBE_PATH" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends ffmpeg \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# Next.js may use an image/cache directory at runtime. Keep that cache on the
# ephemeral /tmp filesystem so the application root can remain read-only.
RUN mkdir -p /tmp/velto-next-cache /tmp/.cache \
    && chown -R nextjs:nodejs /tmp/velto-next-cache /tmp/.cache \
    && mkdir -p .next \
    && rm -rf .next/cache \
    && ln -s /tmp/velto-next-cache .next/cache

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/runtime-health?mode=live').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

STOPSIGNAL SIGTERM
CMD ["sh", "-c", "node scripts/validate-runtime-env.mjs web && exec node server.js"]
