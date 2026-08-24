FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /app/session /app/data /app/database \
  && chown -R node:node /app

USER node

CMD ["node", "index.js"]
