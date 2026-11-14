# Foundation + Database Implementation Plan (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo and the Postgres schema (pgvector + pg_trgm) with Drizzle migrations, so every later subsystem (ETL, agent, evals, web) has a typed DB to build on.

**Architecture:** Lightweight pnpm monorepo (`apps/*`, `packages/db`). Schema lives in `packages/db` (TS Drizzle definitions = types + query builder + migrations), consumed by API, ETL and evals. Postgres runs in Docker locally (pgvector image). A migrate harness creates the `vector`/`pg_trgm` extensions first, then applies Drizzle migrations. OSHA-sourced coded fields are stored as `text` (never enums) so the "messy on purpose" data can't break inserts; enums are used only for fields we control.

**Tech Stack:** Node 22, TypeScript (strict, ESM), pnpm workspaces, Drizzle ORM `^0.45.4` + drizzle-kit `^0.31.11`, `postgres` `^4.1.1` driver, vitest `^5.1.0`, tsx, Docker (`pgvector/pgvector:pg17`).

**Scope of this plan:** monorepo scaffold, docker-compose, `packages/db` schema for all tables in Section 2 of the spec (contractor, contractor_alias, inspection, violation, accident, accident_injury, bid, bid_contractor, accident_chunk, cfr_section), indexes (HNSW / GIN-trgm / partial-unique), the migrate harness, and an integration test proving migrations apply and vector + trgm round-trip. **Out of scope (later plans):** the `contractor_risk` materialized view and `accident_inspection` view (Plan 2 — they depend on the risk formula), any ETL/API/eval/web code.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create the workspace manifest**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "site-safety-intelligence",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "db:generate": "pnpm --filter @ssi/db generate",
    "db:migrate": "pnpm --filter @ssi/db migrate",
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
dist/
data/raw/
.env
*.local
```

- [ ] **Step 5: Create `.env.example`**

```bash
# DOL Open Data Portal API key (env var name is API_KEY_ODP, not DOL_API_KEY)
API_KEY_ODP=
# Groq LLM key (used by the agent in Plan 3)
GROQ_API_KEY=
# Local Postgres (matches docker-compose below)
DATABASE_URL=postgres://ssi:ssi@localhost:5433/ssi
# Local embedding model (Plan 2/3)
EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
```

- [ ] **Step 6: Create `.env` from the example and fill the real key**

Run: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`), then set `API_KEY_ODP` to the value already present in the repo's existing `.env` if any. Leave `GROQ_API_KEY` blank for now.

- [ ] **Step 7: Commit**

```bash
git init
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example
git commit -m "chore: scaffold pnpm monorepo"
```

---

### Task 2: Local Postgres via Docker

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

Port `5433` on the host avoids clashing with any local Postgres on 5432.
```yaml
services:
  db:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_USER: ssi
      POSTGRES_PASSWORD: ssi
      POSTGRES_DB: ssi
    ports:
      - "5433:5432"
    volumes:
      - ssi_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ssi -d ssi"]
      interval: 3s
      timeout: 3s
      retries: 10
volumes:
  ssi_pgdata:
```

- [ ] **Step 2: Start the database and verify it is healthy**

Run: `docker compose up -d`
Then: `docker compose ps`
Expected: the `db` service is `running` and `healthy`.

- [ ] **Step 3: Verify connectivity and image extensions availability**

Run: `docker compose exec db psql -U ssi -d ssi -c "SELECT 1;"`
Expected: a single row returning `1`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add local postgres (pgvector) via docker compose"
```

---

### Task 3: `packages/db` package scaffold

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema/index.ts` (empty barrel for now)

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@ssi/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "tsx src/migrate.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.4",
    "postgres": "^4.1.1"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.11",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^5.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
```

- [ ] **Step 4: Create `packages/db/src/client.ts`**

```ts
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
```

- [ ] **Step 5: Create an empty schema barrel `packages/db/src/schema/index.ts`**

```ts
// Re-exports every table module. Populated in Tasks 4-8.
export {};
```

- [ ] **Step 6: Install dependencies**

Run from repo root: `pnpm install`
Expected: installs without errors; `packages/db/node_modules` (or hoisted root) present.

- [ ] **Step 7: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "chore(db): scaffold @ssi/db package with drizzle config and client"
```

---

### Task 4: Schema — shared helpers + contractors

**Files:**
- Create: `packages/db/src/schema/_shared.ts`
- Create: `packages/db/src/schema/contractors.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `_shared.ts` (custom `tsvector` type + enums we control)**

```ts
import { customType } from 'drizzle-orm/pg-core';
import { pgEnum } from 'drizzle-orm/pg-core';

// Postgres tsvector has no native Drizzle type; declare a minimal custom type.
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// Enums ONLY for fields we control (never for raw OSHA codes — messy data).
export const matchMethodEnum = pgEnum('match_method', ['exact', 'trgm', 'typo']);
export const bidStatusEnum = pgEnum('bid_status', ['matched', 'not_found']);
```

- [ ] **Step 2: Create `contractors.ts`**

```ts
import { sql } from 'drizzle-orm';
import {
  pgTable, serial, integer, text, timestamp, numeric, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { matchMethodEnum } from './_shared.js';

export const contractor = pgTable('contractor', {
  id: serial('id').primaryKey(),
  canonicalName: text('canonical_name').notNull(),
  displayName: text('display_name').notNull(),
  normName: text('norm_name').notNull(),
  primaryState: text('primary_state'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('contractor_norm_name_trgm_idx').using('gin', t.normName.op('gin_trgm_ops')),
]);

export const contractorAlias = pgTable('contractor_alias', {
  id: serial('id').primaryKey(),
  contractorId: integer('contractor_id').notNull().references(() => contractor.id),
  rawName: text('raw_name').notNull(),
  normName: text('norm_name').notNull(),
  occurrences: integer('occurrences').notNull().default(1),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  matchMethod: matchMethodEnum('match_method').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }),
}, (t) => [
  uniqueIndex('contractor_alias_uq').on(t.contractorId, t.normName),
  index('contractor_alias_norm_trgm_idx').using('gin', t.normName.op('gin_trgm_ops')),
]);
```

- [ ] **Step 3: Export from the barrel**

`packages/db/src/schema/index.ts`:
```ts
export * from './contractors.js';
```

- [ ] **Step 4: Typecheck**

Run from repo root: `pnpm --filter @ssi/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): contractor + contractor_alias schema with trgm indexes"
```

---

### Task 5: Schema — inspections + violations

**Files:**
- Create: `packages/db/src/schema/inspections.ts`
- Create: `packages/db/src/schema/violations.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `inspections.ts`**

`contractorId` is nullable (assigned after entity resolution in Plan 2). OSHA codes are `text`.
```ts
import {
  pgTable, bigint, integer, text, date, boolean, index,
} from 'drizzle-orm/pg-core';
import { contractor } from './contractors.js';

export const inspection = pgTable('inspection', {
  activityNr: bigint('activity_nr', { mode: 'number' }).primaryKey(),
  contractorId: integer('contractor_id').references(() => contractor.id),
  estabNameRaw: text('estab_name_raw'),
  siteAddress: text('site_address'),
  siteCity: text('site_city'),
  siteState: text('site_state'),
  siteZip: text('site_zip'),
  naicsCode: text('naics_code'),
  inspType: text('insp_type'),
  inspScope: text('insp_scope'),
  ownerType: text('owner_type'),
  isStatePlan: boolean('is_state_plan'),
  unionStatus: text('union_status'),
  safetyConst: text('safety_const'),
  nrInEstab: integer('nr_in_estab'),
  openDate: date('open_date', { mode: 'string' }),
  closeCaseDate: date('close_case_date', { mode: 'string' }),
}, (t) => [
  index('inspection_contractor_idx').on(t.contractorId),
  index('inspection_state_idx').on(t.siteState),
  index('inspection_naics_idx').on(t.naicsCode),
]);
```

- [ ] **Step 2: Create `violations.ts`**

`UNIQUE (activity_nr, citation_id)` makes ETL upserts idempotent.
```ts
import {
  pgTable, serial, bigint, integer, text, numeric, date, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { inspection } from './inspections.js';

export const violation = pgTable('violation', {
  id: serial('id').primaryKey(),
  activityNr: bigint('activity_nr', { mode: 'number' })
    .notNull()
    .references(() => inspection.activityNr),
  citationId: text('citation_id').notNull(),
  standard: text('standard'),
  violType: text('viol_type'), // S|W|R|O|U (raw OSHA code, kept as text)
  currentPenalty: numeric('current_penalty'),
  initialPenalty: numeric('initial_penalty'),
  nrInstances: integer('nr_instances'),
  nrExposed: integer('nr_exposed'),
  gravity: integer('gravity'),
  issuanceDate: date('issuance_date', { mode: 'string' }),
  abateDate: date('abate_date', { mode: 'string' }),
  finalOrderDate: date('final_order_date', { mode: 'string' }),
}, (t) => [
  uniqueIndex('violation_activity_citation_uq').on(t.activityNr, t.citationId),
  index('violation_activity_idx').on(t.activityNr),
  index('violation_type_idx').on(t.violType),
]);
```

- [ ] **Step 3: Export from the barrel**

Append to `packages/db/src/schema/index.ts`:
```ts
export * from './inspections.js';
export * from './violations.js';
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ssi/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): inspection + violation schema"
```

---

### Task 6: Schema — accidents

**Files:**
- Create: `packages/db/src/schema/accidents.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `accidents.ts`**

`accident` has NO `activity_nr` (link is N:M via `accident_injury.rel_insp_nr`). `rel_insp_nr` is intentionally NOT a foreign key — it may point to an inspection outside the loaded scope (handled/counted in Plan 2).
```ts
import {
  pgTable, serial, bigint, integer, text, date, boolean, index,
} from 'drizzle-orm/pg-core';
import { inspection } from './inspections.js';

export const accident = pgTable('accident', {
  summaryNr: bigint('summary_nr', { mode: 'number' }).primaryKey(),
  eventDate: date('event_date', { mode: 'string' }),
  eventDesc: text('event_desc'),
  projectType: text('project_type'),
  buildStories: integer('build_stories'),
  nonbuildHt: integer('nonbuild_ht'),
  fatalityFlag: boolean('fatality_flag'),
});

export const accidentInjury = pgTable('accident_injury', {
  id: serial('id').primaryKey(),
  summaryNr: bigint('summary_nr', { mode: 'number' })
    .notNull()
    .references(() => accident.summaryNr),
  relInspNr: bigint('rel_insp_nr', { mode: 'number' }), // = inspection.activity_nr, FK NOT forced
  degreeOfInj: text('degree_of_inj'), // 1=Fatality,2=Hospitalized,3=NonHosp (raw code)
  natureOfInj: text('nature_of_inj'),
  partOfBody: text('part_of_body'),
  faultCause: text('fat_cause'),
  fallHt: integer('fall_ht'),
  fallDistance: integer('fall_distance'),
  age: integer('age'),
  sex: text('sex'),
}, (t) => [
  index('accident_injury_summary_idx').on(t.summaryNr),
  index('accident_injury_rel_insp_idx').on(t.relInspNr),
]);

// Referenced here only to document intent; `inspection` import keeps the N:M link explicit.
void inspection;
```

- [ ] **Step 2: Export from the barrel**

Append to `packages/db/src/schema/index.ts`:
```ts
export * from './accidents.js';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ssi/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): accident + accident_injury schema (N:M via rel_insp_nr)"
```

---

### Task 7: Schema — bids

**Files:**
- Create: `packages/db/src/schema/bids.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `bids.ts`**

`bid_contractor.contractor_id` is nullable (subs not found in OSHA); a **partial** unique index enforces one row per matched contractor per bid.
```ts
import { sql } from 'drizzle-orm';
import {
  pgTable, serial, integer, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { contractor } from './contractors.js';
import { bidStatusEnum } from './_shared.js';

export const bid = pgTable('bid', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bidContractor = pgTable('bid_contractor', {
  id: serial('id').primaryKey(),
  bidId: integer('bid_id').notNull().references(() => bid.id),
  contractorId: integer('contractor_id').references(() => contractor.id),
  enteredName: text('entered_name').notNull(),
  trade: text('trade'),
  status: bidStatusEnum('status').notNull(),
}, (t) => [
  uniqueIndex('bid_contractor_uq')
    .on(t.bidId, t.contractorId)
    .where(sql`${t.contractorId} IS NOT NULL`),
]);
```

- [ ] **Step 2: Export from the barrel**

Append to `packages/db/src/schema/index.ts`:
```ts
export * from './bids.js';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ssi/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): bid + bid_contractor schema with partial unique index"
```

---

### Task 8: Schema — RAG tables (accident_chunk, cfr_section)

**Files:**
- Create: `packages/db/src/schema/rag.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `rag.ts`**

`accident_chunk.embedding` is `vector(384)` with an HNSW cosine index; `contractor_ids` is an `int[]` with a GIN index for the containment filter used by `search_incidents`. `cfr_section` is an exact-lookup table (no embedding).
```ts
import {
  pgTable, serial, bigint, integer, text, date, vector, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accident } from './accidents.js';
import { tsvector } from './_shared.js';

export const accidentChunk = pgTable('accident_chunk', {
  id: serial('id').primaryKey(),
  summaryNr: bigint('summary_nr', { mode: 'number' })
    .notNull()
    .references(() => accident.summaryNr),
  contractorIds: integer('contractor_ids').array(),
  eventDate: date('event_date', { mode: 'string' }),
  text: text('text').notNull(),
  tsv: tsvector('tsv'),
  embedding: vector('embedding', { dimensions: 384 }),
  embeddingModel: text('embedding_model'),
}, (t) => [
  index('accident_chunk_embedding_hnsw')
    .using('hnsw', t.embedding.op('vector_cosine_ops')),
  index('accident_chunk_contractors_gin').using('gin', t.contractorIds),
  index('accident_chunk_tsv_gin').using('gin', t.tsv),
]);

export const cfrSection = pgTable('cfr_section', {
  id: serial('id').primaryKey(),
  sectionCode: text('section_code').notNull(),
  title: text('title'),
  text: text('text').notNull(),
}, (t) => [
  uniqueIndex('cfr_section_code_uq').on(t.sectionCode),
]);
```

- [ ] **Step 2: Export from the barrel**

Append to `packages/db/src/schema/index.ts`:
```ts
export * from './rag.js';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ssi/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): accident_chunk (vector+hnsw) + cfr_section schema"
```

---

### Task 9: Migrate harness + generate migrations

**Files:**
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/src/index.ts`
- Create (generated): `packages/db/migrations/*`

- [ ] **Step 1: Create `packages/db/src/index.ts` (public entry)**

```ts
export * from './client.js';
export * as schema from './schema/index.js';
export { runMigrations } from './migrate.js';
```

- [ ] **Step 2: Create `packages/db/src/migrate.ts`**

Creates the extensions BEFORE applying Drizzle migrations (the `vector` column type needs the extension to already exist).
```ts
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
  } finally {
    await sql.end();
  }
}

// Allow `tsx src/migrate.ts` to run it directly.
if (import.meta.url === `file://${process.argv[1]}`) {
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
```

- [ ] **Step 3: Generate the SQL migrations from the schema**

Run from repo root (DATABASE_URL in env): `pnpm db:generate`
Expected: a new folder `packages/db/migrations/` containing a `0000_*.sql` with `CREATE TABLE` statements for all 10 tables plus the indexes, and a `meta/` journal.

- [ ] **Step 4: Inspect the generated SQL for the special indexes**

Run: open the generated `packages/db/migrations/0000_*.sql`.
Expected to contain: `USING hnsw (... vector_cosine_ops)`, `USING gin (... gin_trgm_ops)`, `USING gin ("contractor_ids")`, and the partial `... WHERE "contractor_id" IS NOT NULL` unique index. If any is missing, fix the corresponding schema file and re-run `pnpm db:generate`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/index.ts packages/db/src/migrate.ts packages/db/migrations
git commit -m "feat(db): migrate harness (extensions first) + initial migration"
```

---

### Task 10: Integration test — migrations apply, vector + trgm round-trip

**Files:**
- Create: `packages/db/vitest.config.ts`
- Create: `packages/db/test/schema.int.test.ts`

- [ ] **Step 1: Create `packages/db/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 2: Write the failing integration test**

Requires the Docker DB running and `DATABASE_URL` set. Resets the public schema, applies migrations, then checks extensions + a vector cosine query + a trgm similarity query.
```ts
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
```

- [ ] **Step 3: Run the test to verify it fails first (before wiring is correct)**

Run: `docker compose up -d` then `$env:DATABASE_URL="postgres://ssi:ssi@localhost:5433/ssi"; pnpm --filter @ssi/db test` (bash: `DATABASE_URL=... pnpm --filter @ssi/db test`).
Expected: if anything in Tasks 4-9 is wrong (missing extension ordering, bad index), the test FAILS with a clear error. If it already passes, that is acceptable — the point is the assertions run against a real DB.

- [ ] **Step 4: Fix any failures, then run until green**

Run: `pnpm --filter @ssi/db test`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/vitest.config.ts packages/db/test
git commit -m "test(db): integration test for migrations, pgvector and pg_trgm"
```

---

### Task 11: Repository layer skeleton

**Files:**
- Create: `packages/db/src/repositories/contractor.repository.ts`
- Create: `packages/db/test/contractor.repository.int.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { createClient } from '../src/client.js';
import { runMigrations } from '../src/migrate.js';
import { ContractorRepository } from '../src/repositories/contractor.repository.js';

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1 });
const { db, queryClient } = createClient(url);

beforeAll(async () => {
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @ssi/db test`
Expected: FAIL — `ContractorRepository` cannot be found.

- [ ] **Step 3: Implement the repository**

`packages/db/src/repositories/contractor.repository.ts`:
```ts
import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { contractor } from '../schema/contractors.js';

export type NewContractor = typeof contractor.$inferInsert;
export type Contractor = typeof contractor.$inferSelect;

export class ContractorRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewContractor): Promise<Contractor> {
    const [row] = await this.db.insert(contractor).values(input).returning();
    return row!;
  }

  async findById(id: number): Promise<Contractor | undefined> {
    const [row] = await this.db.select().from(contractor).where(eq(contractor.id, id));
    return row;
  }
}
```

- [ ] **Step 4: Export the repository**

Append to `packages/db/src/index.ts`:
```ts
export * from './repositories/contractor.repository.js';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ssi/db test`
Expected: all tests PASS (schema + repository).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/repositories packages/db/src/index.ts packages/db/test/contractor.repository.int.test.ts
git commit -m "feat(db): ContractorRepository + integration test (repo pattern seed)"
```

---

## Self-Review

**Spec coverage (Section 2 — Data model):**
- contractor + contractor_alias → Task 4 ✓ (trgm GIN, unique(contractor_id, norm_name), occurrences/first_seen/last_seen, match_method, confidence, primary_state).
- inspection (contractor_id nullable, owner_type, is_state_plan) + violation (unique activity_nr+citation_id, nr_instances, viol_type text incl. U) → Tasks 5 ✓.
- accident (no activity_nr) + accident_injury (rel_insp_nr FK not forced) → Task 6 ✓.
- bid + bid_contractor (nullable contractor_id, partial unique, status enum) → Task 7 ✓.
- accident_chunk (vector(384), contractor_ids int[], tsv, embedding_model) HNSW + GIN; cfr_section (unique section_code, no embedding) → Task 8 ✓.
- Extensions vector + pg_trgm, HNSW (not IVFFlat) → Tasks 9 & 10 ✓.
- Repository pattern lives in packages/db → Task 11 ✓.
- **Deferred to Plan 2 (documented in scope):** `accident_inspection` view and `contractor_risk` materialized view (depend on risk formula). Not a gap.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `createClient` returns `{ db, queryClient }` (Task 3) and both are used consistently in Tasks 10/11. `Database` type exported from `client.ts` and imported by the repository. Table exports use `.js` ESM specifiers everywhere. `runMigrations(url?)` signature consistent across Tasks 9/10/11. Enum names (`match_method`, `bid_status`) match between `_shared.ts` and usage.

**Note for executor:** integration tests need Docker up and `DATABASE_URL` set to `postgres://ssi:ssi@localhost:5433/ssi`. On Windows PowerShell: `$env:DATABASE_URL="postgres://ssi:ssi@localhost:5433/ssi"`.
