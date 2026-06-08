FROM node:22-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY docker/entrypoint-api.sh ./docker/entrypoint-api.sh

RUN chmod +x /app/docker/entrypoint-api.sh

WORKDIR /app/backend

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV ENABLE_ADMIN=true

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD sh -c 'wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1'

ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint-api.sh"]
