FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
COPY --chown=node:node assets ./assets

ENV NODE_ENV=production
ENV PORT=3001

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const port=process.env.PORT||'3001';fetch('http://127.0.0.1:'+port+'/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

STOPSIGNAL SIGTERM
CMD ["node", "src/server.js"]
