import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function runMigrations(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, { max: 1 });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: './migrations' });

    // Apply hand-written post-migrations (materialized views / objects Drizzle can't express).
    const postDir = './migrations/post';
    try {
      const files = (await readdir(postDir)).filter((f) => f.endsWith('.sql')).sort();
      for (const f of files) await sql.unsafe(await readFile(join(postDir, f), 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  } finally {
    await sql.end();
  }
}

// Allow `tsx src/migrate.ts` to run it directly (cross-platform entrypoint check).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(() => {
      console.log('migrations applied');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
