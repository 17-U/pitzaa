import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma tel que reçu dans le callback de `$transaction` — mêmes modèles
 * que PrismaService, sans les méthodes de cycle de vie / transaction imbriquée.
 */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
