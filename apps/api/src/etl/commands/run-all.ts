import { loadInspections } from './load-inspections.js';
import { loadViolations } from './load-violations.js';
import { loadAccidents } from './load-accidents.js';
import { resolveEntities } from './resolve-entities.js';
import { embedChunks } from './embed-chunks.js';
import { refreshRisk } from './refresh-risk.js';

/**
 * Full pipeline in the fixed order (A2/A3-aware). NOTE: the DOL API is aggressively rate-limited,
 * so loadViolations/loadAccidents over the whole set are partial-tolerant and resumable (cached raw
 * pages). For a fast demo, prefer: run-all once to populate inspections + resolve + refresh, then
 * `etl:seed` for the bid-first targeted enrichment. Seed the bid AFTER resolve+refresh (ER TRUNCATEs).
 */
async function main(): Promise<void> {
  await loadInspections();
  await loadViolations();
  await loadAccidents();
  await resolveEntities();
  await embedChunks();
  await refreshRisk();
  console.log('ETL complete (run `etl:seed` to create the demo bid + targeted enrichment)');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
