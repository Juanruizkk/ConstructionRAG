import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

// Load the monorepo-root .env so service/repo tests see DATABASE_URL etc.
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });
