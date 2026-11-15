# Pitzaa

Application de partage d'abonnements numériques et d'achat-revente de cartes cadeaux, pour le Cameroun puis la zone CEMAC. Paiements en mobile money (MTN MoMo, Orange Money) via Fapshi (principal) et KPay (secours). Devise : franc CFA (XAF), sans décimales.

## Structure du monorepo

```
pitzaa/
  apps/
    api/      # NestJS — API REST + Swagger (/docs)
    mobile/   # Expo (React Native) — application mobile
    admin/    # Next.js — back-office + site vitrine
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

# 4. Lancer l'API (NestJS) — http://localhost:3000, docs Swagger sur /docs
pnpm --filter @pitzaa/api start:dev

# 5. Lancer le back-office (Next.js) — http://localhost:3100
pnpm --filter @pitzaa/admin dev

# 6. Lancer l'application mobile (Expo)
pnpm --filter @pitzaa/mobile start
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
```

## Tester l'API

Une fois l'API lancée (étape 4 ci-dessus) :

- `GET http://localhost:3000/` → informations de base (`{ "name": "Pitzaa API", "version": "0.0.1" }`)
- `GET http://localhost:3000/health` → sonde de santé (`{ "status": "ok", "timestamp": "..." }`)
- `http://localhost:3000/docs` → documentation Swagger (OpenAPI)

## Base de données de test

`docker-compose.yml` démarre un second service PostgreSQL (`postgres-test`, port `5433` par défaut) dédié aux tests automatisés (API, grand livre, etc.), isolé de la base de développement.

## Questions ouvertes

Voir [QUESTIONS.md](./QUESTIONS.md) pour la liste des points qui nécessitent une information ou une décision de votre part (documentation Fapshi/KPay, fournisseur SMS, hébergement, etc.).

## Avancement

Le projet est construit phase par phase (voir le prompt de pilotage). État actuel : **Phase 0 — Socle** terminée.
