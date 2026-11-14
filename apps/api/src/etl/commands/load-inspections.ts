import { createClient, InspectionRepository } from '@ssi/db';
import { SCOPE } from '../../config.js';
import { iteratePages, chunk } from '../dol-client.js';
import { isMain } from '../is-main.js';
import { toInspection } from '../mappers/inspection.mapper.js';

export async function loadInspections(): Promise<number> {
  const { db, queryClient } = createClient();
  const repo = new InspectionRepository(db);
  const filter = {
    and: [
      { field: 'naics_code', operator: 'like', value: `${SCOPE.naicsPrefix}%` },
      { field: 'site_state', operator: 'in', value: [...SCOPE.states] },
      { field: 'open_date', operator: 'gt', value: SCOPE.openDateFrom },
    ],
  };
  const fields = [
    'activity_nr', 'estab_name', 'site_address', 'site_city', 'site_state',
    'site_zip', 'naics_code', 'insp_type', 'open_date',
  ].join(',');

  let total = 0;
  try {
    for await (const page of iteratePages('inspection', filter, SCOPE.pageLimit, fields)) {
      const rows = page.map(toInspection).filter((r) => Number.isFinite(r.activityNr));
      for (const part of chunk(rows, 1000)) await repo.upsertMany(part);
      total += rows.length;
    }
  } catch (e) {
    // Insert-as-you-go: persist what we fetched; cached pages make the next run resumable.
    console.warn(`inspections fetch stopped early (partial): ${e instanceof Error ? e.message : String(e)}`);
  }
  await queryClient.end();
  console.log(`inspections loaded: ${total}`);
  return total;
}

if (isMain(import.meta.url)) {
  loadInspections().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
