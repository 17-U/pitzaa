import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env') });

// Les tests e2e doivent toujours cibler la base de test, jamais la base de dev,
// même si DATABASE_URL est déjà présent dans l'environnement ou le .env.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
