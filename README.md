# Pitzaa

Application de partage d'abonnements numériques et d'achat-revente de cartes cadeaux, pour le Cameroun puis la zone CEMAC. Paiements en mobile money (MTN MoMo, Orange Money) via Fapshi (principal) et KPay (secours). Devise : franc CFA (XAF), sans décimales.

Pas d'application mobile : tout le produit (site vitrine, espace utilisateur, back-office) est servi en web par `apps/web`.

## Structure du monorepo

```
pitzaa/
  apps/
    api/      # NestJS — API REST + Swagger (/docs)
    web/      # Next.js — site vitrine + espace utilisateur + back-office
  packages/
    shared/   # @pitzaa/shared : types, schémas (zod), constantes communes
  docker-compose.yml
  .env.example
```

- Monorepo géré avec **pnpm workspaces** + **Turborepo**.
- TypeScript strict partout.
- Montants toujours stockés en **entiers XAF** (jamais de `float`).

## Prérequis

- Node.js >= 20
- pnpm 9 (`corepack enable` puis `corepack use pnpm@9.12.0`, ou `npm i -g pnpm@9.12.0`)
- Docker (PostgreSQL + Redis en local)

## Démarrage

```bash
# 1. Installer les dépendances de tout le monorepo
pnpm install

# 2. Copier les variables d'environnement et les compléter si besoin
cp .env.example .env

# 3. Démarrer PostgreSQL et Redis
docker compose up -d

# 3bis. Appliquer les migrations Prisma (base de dev + base de test)
pnpm --filter @pitzaa/api prisma:migrate:dev

# 4. Lancer l'API (NestJS) — http://localhost:3000, docs Swagger sur /docs
pnpm --filter @pitzaa/api start:dev

# 5. Lancer l'app web (Next.js) — http://localhost:3100
pnpm --filter @pitzaa/web dev
```

Ou, pour tout lancer en parallèle via Turborepo :

```bash
pnpm dev
```

## Vérifications

```bash
pnpm lint        # lint sur tous les packages
pnpm typecheck    # vérification des types sur tous les packages
pnpm test         # tests unitaires (Vitest / Jest) sur tous les packages
pnpm build        # build de production sur tous les packages
```

Chaque commande peut être restreinte à un seul package avec `--filter`, par exemple :

```bash
pnpm --filter @pitzaa/api test

# Tests end-to-end de l'API (Supertest), contre la base de données de test
pnpm --filter @pitzaa/api test:e2e
```

## Tester l'API

Une fois l'API lancée (étape 4 ci-dessus) :

- `GET http://localhost:3000/` → informations de base (`{ "name": "Pitzaa API", "version": "0.0.1" }`)
- `GET http://localhost:3000/health` → sonde de santé (`{ "status": "ok", "timestamp": "..." }`)
- `http://localhost:3000/docs` → documentation Swagger (OpenAPI), incluant les routes `/auth/*`
- Inscription / connexion : `POST /auth/register-or-login/request-otp` puis `POST /auth/register-or-login/verify-otp` (le code OTP est loggé par le `MockSmsProvider` en développement, voir les logs de l'API)

## Base de données et Prisma

`docker-compose.yml` démarre un second service PostgreSQL (`postgres-test`) dédié aux tests automatisés (API, grand livre, etc.), isolé de la base de développement. Les ports par défaut (`POSTGRES_PORT`, `TEST_POSTGRES_PORT`, `REDIS_PORT`) peuvent être changés dans `.env` si un autre projet local (ou un service PostgreSQL natif, fréquent sur Windows) les utilise déjà.

Le schéma de données vit dans [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma). Commandes utiles (depuis la racine) :

```bash
# Créer/appliquer une migration en développement (base de dev)
pnpm --filter @pitzaa/api prisma:migrate:dev

# Appliquer les migrations existantes sans en créer de nouvelle (ex: CI, prod)
pnpm --filter @pitzaa/api prisma:migrate:deploy

# Régénérer le client Prisma après un changement de schéma
pnpm --filter @pitzaa/api prisma:generate

# Explorer les données via Prisma Studio
pnpm --filter @pitzaa/api prisma:studio
```

Ces commandes chargent automatiquement le `.env` racine (via `dotenv-cli`). Pour appliquer une migration sur la base de **test**, surchargez `DATABASE_URL` :

```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @pitzaa/api exec prisma migrate deploy
```

## Questions ouvertes

Voir [QUESTIONS.md](./QUESTIONS.md) pour la liste des points qui nécessitent une information ou une décision de votre part (documentation Fapshi/KPay, fournisseur SMS, hébergement, etc.).

## Avancement

Le projet est construit phase par phase (voir le prompt de pilotage, adapté : pas d'app mobile — tout en web dans `apps/web`). État actuel : **Phase 1 — Modèle de données et authentification** terminée (schéma Prisma complet, inscription/connexion par téléphone + OTP, JWT avec rotation des refresh tokens, rôles, PIN Pitzaa, export et suppression de compte).
