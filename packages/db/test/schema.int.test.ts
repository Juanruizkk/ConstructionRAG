import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { runMigrations } from '../src/migrate.js';

const url = process.env.DATABASE_URL;
const sql = postgres(url!, { max: 1 });

beforeAll(async () => {
  if (!url) throw new Error('DATABASE_URL is not set (start docker compose + set env)');
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await runMigrations(url);
});

afterAll(async () => {
  await sql.end();
});

describe('schema migration', () => {
  it('installs the required extensions', async () => {
    const rows = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_trgm')`;
    const names = rows.map((r) => r.extname).sort();
    expect(names).toEqual(['pg_trgm', 'vector']);
  });

  it('creates all 10 tables', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const names = rows.map((r) => r.table_name);
    for (const t of [
      'contractor', 'contractor_alias', 'inspection', 'violation',
      'accident', 'accident_injury', 'bid', 'bid_contractor',
      'accident_chunk', 'cfr_section',
    ]) {
      expect(names).toContain(t);
    }
  });

  it('round-trips an accident_chunk embedding via cosine distance', async () => {
    await sql`INSERT INTO accident ("summary_nr") VALUES (1)`;
    const vec = `[${Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`;
    await sql`
      INSERT INTO accident_chunk ("summary_nr", "text", "embedding", "embedding_model")
      VALUES (1, 'worker fell from roof', ${vec}::vector, 'test')`;
    const rows = await sql<{ d: number }[]>`
      SELECT (embedding <=> ${vec}::vector) AS d FROM accident_chunk LIMIT 1`;
    expect(rows[0]!.d).toBeCloseTo(0, 5);
  });

  it('supports pg_trgm similarity on contractor.norm_name', async () => {
    await sql`
      INSERT INTO contractor ("canonical_name", "display_name", "norm_name")
      VALUES ('ABC ROOFING', 'ABC Roofing Inc', 'ABC ROOFING')`;
    const rows = await sql<{ sim: number }[]>`
      SELECT similarity(norm_name, 'ABC ROOFNG') AS sim FROM contractor LIMIT 1`;
    expect(rows[0]!.sim).toBeGreaterThan(0.3);
  });
});
