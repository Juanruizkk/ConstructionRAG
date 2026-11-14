import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export function createClient(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');
  const queryClient = postgres(url);
  const db = drizzle(queryClient, { schema, casing: 'snake_case' });
  return { db, queryClient };
}

export type Database = ReturnType<typeof createClient>['db'];
