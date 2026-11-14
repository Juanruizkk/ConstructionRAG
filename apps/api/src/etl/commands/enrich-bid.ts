import { createClient } from '@ssi/db';
import { isMain } from '../is-main.js';
import { loadAccidents } from './load-accidents.js';
import { embedChunks } from './embed-chunks.js';
import { refreshRisk } from './refresh-risk.js';

/** Load accidents (narratives/fatalities for RAG) for the current bid's inspections, then embed + refresh. */
export async function enrichBid(): Promise<void> {
  const { queryClient: sql } = createClient();
  const [bid] = await sql<{ id: number }[]>`SELECT id FROM bid ORDER BY id DESC LIMIT 1`;
  if (!bid) { console.log('no bid to enrich'); await sql.end(); return; }
  const rows = await sql<{ activity_nr: string }[]>`
    SELECT i.activity_nr FROM inspection i
    JOIN bid_contractor bc ON bc.contractor_id = i.contractor_id
    WHERE bc.bid_id = ${bid.id}`;
  const activityNrs = rows.map((r) => Number(r.activity_nr));
  await sql.end();
  console.log(`enriching bid ${bid.id}: ${activityNrs.length} inspections`);
  await loadAccidents(activityNrs);
  await embedChunks();
  await refreshRisk();
}

if (isMain(import.meta.url)) {
  enrichBid().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
