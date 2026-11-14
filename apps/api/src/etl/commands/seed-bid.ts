import { createClient } from '@ssi/db';
import { isMain } from '../is-main.js';
import { loadViolations } from './load-violations.js';
import { loadAccidents } from './load-accidents.js';

/**
 * Bid-first targeted load. Picks a realistic demo bid (subs with accident/fatality inspections,
 * some mid, some clean, one not-in-OSHA), then fetches violations + accidents ONLY for those
 * subs' inspections — a few dozen API calls instead of thousands (works around the DOL rate limit).
 */
export async function seedBid(): Promise<void> {
  const { queryClient: sql } = createClient();

  // Fresh bid each run.
  await sql`DELETE FROM bid_contractor`;
  await sql`DELETE FROM bid`;
  const [bid] = await sql<{ id: number }[]>`
    INSERT INTO bid (name) VALUES ('Downtown Office Tower — GC bid') RETURNING id`;
  const bidId = bid!.id;

  // Risky: subs with accident/fatality inspections (insp_type A/M), avoiding mega-clusters.
  const risky = await sql<{ id: number }[]>`
    SELECT c.id FROM contractor c JOIN inspection i ON i.contractor_id = c.id
    GROUP BY c.id
    HAVING count(*) FILTER (WHERE i.insp_type IN ('A','M')) >= 3 AND count(*) <= 40
    ORDER BY count(*) FILTER (WHERE i.insp_type IN ('A','M')) DESC
    LIMIT 6`;
  // Mid: decent inspection count, no incident type.
  const mid = await sql<{ id: number }[]>`
    SELECT c.id FROM contractor c JOIN inspection i ON i.contractor_id = c.id
    GROUP BY c.id
    HAVING count(*) FILTER (WHERE i.insp_type IN ('A','M')) = 0 AND count(*) BETWEEN 4 AND 15
    ORDER BY count(*) DESC LIMIT 4`;
  // Clean-ish: very few inspections, no incident.
  const clean = await sql<{ id: number }[]>`
    SELECT c.id FROM contractor c JOIN inspection i ON i.contractor_id = c.id
    GROUP BY c.id
    HAVING count(*) FILTER (WHERE i.insp_type IN ('A','M')) = 0 AND count(*) BETWEEN 1 AND 2
    ORDER BY random() LIMIT 2`;

  const matchedIds = [...risky, ...mid, ...clean].map((r) => r.id);
  for (const id of matchedIds) {
    await sql`
      INSERT INTO bid_contractor (bid_id, contractor_id, entered_name, status)
      SELECT ${bidId}, ${id}, display_name, 'matched' FROM contractor WHERE id = ${id}`;
  }
  // A sub with no OSHA record.
  await sql`
    INSERT INTO bid_contractor (bid_id, contractor_id, entered_name, status)
    VALUES (${bidId}, NULL, 'Brand New Scaffolding LLC', 'not_found')`;

  const anrRows = await sql<{ activity_nr: string }[]>`
    SELECT activity_nr FROM inspection WHERE contractor_id = ANY(${matchedIds})`;
  const activityNrs = anrRows.map((r) => Number(r.activity_nr));
  await sql.end();

  console.log(`seeded bid ${bidId}: ${matchedIds.length} matched + 1 not_found; ${activityNrs.length} inspections to enrich`);

  // Targeted enrichment (only the bid's inspections).
  await loadViolations(activityNrs);
  await loadAccidents(activityNrs);
}

if (isMain(import.meta.url)) {
  seedBid().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
