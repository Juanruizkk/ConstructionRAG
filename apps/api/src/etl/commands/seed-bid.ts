import { createClient } from '@ssi/db';
import { isMain } from '../is-main.js';
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

  // Risky: subs with the most serious/willful/repeat violations actually loaded.
  const risky = await sql<{ id: number }[]>`
    SELECT c.id FROM contractor c
    JOIN inspection i ON i.contractor_id = c.id
    JOIN violation v ON v.activity_nr = i.activity_nr
    GROUP BY c.id
    ORDER BY count(*) FILTER (WHERE v.viol_type IN ('S','W','R')) DESC, count(*) DESC
    LIMIT 6`;
  // Mid: some violations, lower severity.
  const mid = await sql<{ id: number }[]>`
    SELECT c.id FROM contractor c
    JOIN inspection i ON i.contractor_id = c.id
    JOIN violation v ON v.activity_nr = i.activity_nr
    WHERE c.id NOT IN (
      SELECT c2.id FROM contractor c2
      JOIN inspection i2 ON i2.contractor_id = c2.id
      JOIN violation v2 ON v2.activity_nr = i2.activity_nr
      GROUP BY c2.id ORDER BY count(*) FILTER (WHERE v2.viol_type IN ('S','W','R')) DESC, count(*) DESC LIMIT 6)
    GROUP BY c.id
    ORDER BY count(*) DESC LIMIT 4`;
  // Clean-ish: inspected, zero violations loaded (a positive signal, with the "no record != safe" caveat).
  const clean = await sql<{ id: number }[]>`
    SELECT c.id FROM contractor c
    JOIN inspection i ON i.contractor_id = c.id
    WHERE NOT EXISTS (SELECT 1 FROM violation v JOIN inspection i3 ON i3.activity_nr = v.activity_nr WHERE i3.contractor_id = c.id)
    GROUP BY c.id HAVING count(*) BETWEEN 1 AND 3
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

  console.log(`seeded bid ${bidId}: ${matchedIds.length} matched + 1 not_found; ${activityNrs.length} inspections`);

  // Targeted enrichment of the bid's inspections. Violations for these subs are already loaded;
  // attempt accidents (narratives/fatalities for RAG). Resilient: a DOL rate-limit just leaves it empty.
  if (process.env.ENRICH !== '0') {
    await loadAccidents(activityNrs);
  }
}

if (isMain(import.meta.url)) {
  seedBid().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
