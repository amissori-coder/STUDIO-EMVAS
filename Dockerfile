# Studio EMVAS - immagine di produzione
# Base Debian slim con openssl: richiesto dai motori di Prisma ed evita i problemi
# di compatibilità delle librerie di sistema che si incontrano su Alpine/musl.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM base AS build
# La chiave pubblica VAPID viene incorporata nel bundle client alla build (NEXT_PUBLIC_*): passala come
# build arg (docker-compose la legge dal .env). L'app la legge comunque anche a runtime da /api/push/config.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:../data/emvas.db"
RUN npx prisma generate && npx next build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund && npx prisma generate && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npx", "next", "start"]
