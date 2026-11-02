# Local learning image. Production deployment needs its own configuration.
FROM node:24-bookworm-slim
WORKDIR /app

# Cache dependencies independently of application changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.html styles.css robots.txt sitemap.xml ./
COPY src ./src
COPY image ./image
COPY scripts ./scripts
COPY docker/*.mjs ./docker/
RUN mkdir -p /app/.vibelog-data && chown node:node /app/.vibelog-data

ENV NODE_ENV=development LISTEN_HOST=0.0.0.0 PORT=4173 APP_URL=http://localhost:4174
USER node
EXPOSE 4173
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=6 CMD ["node", "--input-type=module", "-e", "const r = await fetch('http://127.0.0.1:4173/healthz'); process.exit(r.ok ? 0 : 1)"]
CMD ["node", "scripts/server.mjs"]
