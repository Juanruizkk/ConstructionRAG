import { normalizeName } from '@ssi/db';
import postgres from 'postgres';
import { env } from '../../config.js';
import { clusterFromPairs, trigramSim } from '../er/cluster.js';
import { isMain } from '../is-main.js';

interface Agg {
  state: string;
  norm: string;
  count: number;
  rawCounts: Map<string, number>;
  activityNrs: number[];
}

function topKey(m: Map<string, number>, fallback: string): string {
  let best = fallback;
  let bestN = -1;
  for (const [k, n] of m) if (n > bestN) { best = k; bestN = n; }
  return best;
}

async function chunkedInsert(sql: postgres.Sql, table: string, rows: Record<string, unknown>[], size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    const part = rows.slice(i, i + size);
    await sql`INSERT INTO ${sql(table)} ${sql(part)}`;
  }
}

export async function resolveEntities(): Promise<void> {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    // A2 — idempotency: clear previous resolution WITHOUT cascading into inspection.
    // (TRUNCATE ... CASCADE on contractor would wipe inspection via its FK — never use it here.)
    await sql`UPDATE inspection SET contractor_id = NULL`;
    await sql`DELETE FROM bid_contractor`;
    await sql`DELETE FROM contractor_alias`;
    await sql`DELETE FROM contractor`;

    const insp = await sql<{ activity_nr: string; estab_name_raw: string | null; site_state: string | null }[]>`
      SELECT activity_nr, estab_name_raw, site_state FROM inspection`;

    // Group distinct normalized names per state.
    const byKey = new Map<string, Agg>();
    for (const r of insp) {
      const norm = normalizeName(r.estab_name_raw ?? '');
      if (!norm) continue;
      const state = r.site_state ?? 'NA';
      const key = `${state}|${norm}`;
      let a = byKey.get(key);
      if (!a) { a = { state, norm, count: 0, rawCounts: new Map(), activityNrs: [] }; byKey.set(key, a); }
      a.count += 1;
      const raw = (r.estab_name_raw ?? '').trim() || norm;
      a.rawCounts.set(raw, (a.rawCounts.get(raw) ?? 0) + 1);
      a.activityNrs.push(Number(r.activity_nr));
    }
    const aggs = [...byKey.values()];
    const norms = aggs.map((a) => a.norm);
    const states = aggs.map((a) => a.state);
    const weights = aggs.map((a) => a.count);
    const keyToIdx = new Map<string, number>();
    aggs.forEach((a, i) => keyToIdx.set(`${a.state}|${a.norm}`, i));

    // A1 — candidate pairs via pg_trgm % on a GIN-indexed temp table, blocked by state.
    await sql`CREATE TEMP TABLE er_name (state text, norm text)`;
    await chunkedInsert(sql, 'er_name', aggs.map((a) => ({ state: a.state, norm: a.norm })), 2000);
    await sql`CREATE INDEX er_name_trgm ON er_name USING gin (norm gin_trgm_ops)`;
    await sql`ANALYZE er_name`;
    await sql`SELECT set_limit(0.65)`;
    const pairRows = await sql<{ state: string; na: string; nb: string }[]>`
      SELECT a.state AS state, a.norm AS na, b.norm AS nb
      FROM er_name a JOIN er_name b
        ON a.state = b.state AND a.norm < b.norm AND a.norm % b.norm`;

    const pairs: Array<[number, number]> = [];
    for (const p of pairRows) {
      const i = keyToIdx.get(`${p.state}|${p.na}`);
      const j = keyToIdx.get(`${p.state}|${p.nb}`);
      if (i !== undefined && j !== undefined) pairs.push([i, j]);
    }

    const clusters = clusterFromPairs(norms, weights, pairs).filter((c) => c.length > 0);

    // Build canonical contractor rows (one per cluster).
    const contractorRows = clusters.map((cl) => {
      const canonicalIdx = cl.reduce((b, i) => (weights[i]! > weights[b]! ? i : b), cl[0]!);
      const rawCounts = new Map<string, number>();
      for (const i of cl) for (const [raw, c] of aggs[i]!.rawCounts) rawCounts.set(raw, (rawCounts.get(raw) ?? 0) + c);
      return {
        canonical_name: norms[canonicalIdx]!,
        display_name: topKey(rawCounts, norms[canonicalIdx]!),
        norm_name: norms[canonicalIdx]!,
        primary_state: states[canonicalIdx]!,
        _canonicalIdx: canonicalIdx,
      };
    });

    // Bulk insert contractors, keep ids aligned with clusters order.
    const ids: number[] = [];
    for (let i = 0; i < contractorRows.length; i += 1000) {
      const part = contractorRows.slice(i, i + 1000).map(({ _canonicalIdx, ...r }) => r);
      const ret = await sql<{ id: number }[]>`INSERT INTO contractor ${sql(part)} RETURNING id`;
      ids.push(...ret.map((r) => r.id));
    }

    // Aliases + inspection assignment.
    const aliasRows: Record<string, unknown>[] = [];
    const assignRows: Record<string, unknown>[] = [];
    clusters.forEach((cl, k) => {
      const cid = ids[k]!;
      const canonicalIdx = contractorRows[k]!._canonicalIdx;
      for (const i of cl) {
        const isCanon = i === canonicalIdx;
        aliasRows.push({
          contractor_id: cid,
          raw_name: topKey(aggs[i]!.rawCounts, norms[i]!),
          norm_name: norms[i]!,
          occurrences: weights[i]!,
          match_method: isCanon ? 'exact' : 'trgm',
          confidence: isCanon ? '1.0000' : trigramSim(norms[i]!, norms[canonicalIdx]!).toFixed(4),
        });
        for (const anr of aggs[i]!.activityNrs) assignRows.push({ activity_nr: anr, contractor_id: cid });
      }
    });
    await chunkedInsert(sql, 'contractor_alias', aliasRows, 1000);

    await sql`CREATE TEMP TABLE er_assign (activity_nr bigint, contractor_id int)`;
    await chunkedInsert(sql, 'er_assign', assignRows, 2000);
    await sql`UPDATE inspection i SET contractor_id = a.contractor_id FROM er_assign a WHERE i.activity_nr = a.activity_nr`;

    const big = clusters.filter((c) => c.length > 50).length;
    console.log(`contractors: ${ids.length}, aliases: ${aliasRows.length}, inspections assigned: ${assignRows.length}, suspicious_large_clusters: ${big}`);
  } finally {
    await sql.end();
  }
}

if (isMain(import.meta.url)) {
  resolveEntities().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
