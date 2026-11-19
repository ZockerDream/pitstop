# ---- Build: Client (Vite) und Server (esbuild) bauen, danach nur Laufzeit-Abhängigkeiten behalten
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Laufzeit
FROM node:24-alpine
RUN apk add --no-cache su-exec tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/pitstop /usr/local/bin/pitstop
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/pitstop
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--", "entrypoint.sh"]
CMD ["node", "dist/server/main.js"]
