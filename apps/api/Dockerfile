# Build multi-étapes pour @pitzaa/api dans le monorepo pnpm. Le contexte de build
# doit être la racine du monorepo (voir docker-compose.prod.yml : `context: .`),
# car @pitzaa/api dépend de @pitzaa/shared via workspace:*.

FROM node:20-alpine AS base
# openssl : sans lui, Prisma ne détecte pas la libssl d'Alpine et peut échouer au
# démarrage (moteur de requête lié à la mauvaise version de libssl).
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS build
# Copié séparément pour profiter du cache Docker tant que les manifests ne changent pas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN pnpm --filter @pitzaa/shared build
# Le client Prisma doit être généré avant `nest build` (il est importé statiquement).
RUN pnpm --filter @pitzaa/api exec prisma generate
RUN pnpm --filter @pitzaa/api build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S pitzaa && adduser -S pitzaa -G pitzaa

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

USER pitzaa
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
