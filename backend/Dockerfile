FROM node:22-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY docker/entrypoint-api.sh ./docker/entrypoint-api.sh
COPY .env.example ./.env.example

RUN chmod +x /app/docker/entrypoint-api.sh

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint-api.sh"]
