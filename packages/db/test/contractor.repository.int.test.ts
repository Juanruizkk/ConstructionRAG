import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { createClient } from '../src/client.js';
import { runMigrations } from '../src/migrate.js';
import { ContractorRepository } from '../src/repositories/contractor.repository.js';

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1 });
const { db, queryClient } = createClient(url);

beforeAll(async () => {
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await runMigrations(url);
});

afterAll(async () => {
  await sql.end();
  await queryClient.end();
});

describe('ContractorRepository', () => {
  it('inserts and finds a contractor by id', async () => {
    const repo = new ContractorRepository(db);
    const created = await repo.create({
      canonicalName: 'ABC ROOFING',
      displayName: 'ABC Roofing Inc',
      normName: 'ABC ROOFING',
      primaryState: 'CA',
    });
    const found = await repo.findById(created.id);
    expect(found?.displayName).toBe('ABC Roofing Inc');
  });
});
