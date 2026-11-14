import { createClient, InspectionRepository } from '@ssi/db';
import { SCOPE } from '../../config.js';
import { fetchAll, chunk } from '../dol-client.js';
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
    'activity_nr', 'reporting_id', 'estab_name', 'site_address', 'site_city', 'site_state',
    'site_zip', 'naics_code', 'insp_type', 'insp_scope', 'owner_type', 'union_status',
    'safety_const', 'nr_in_estab', 'open_date', 'close_case_date',
  ].join(',');
  const raw = await fetchAll('inspection', filter, SCOPE.pageLimit, fields);
  const rows = raw.map(toInspection).filter((r) => Number.isFinite(r.activityNr));
  for (const part of chunk(rows, 1000)) await repo.upsertMany(part);
  await queryClient.end();
  console.log(`inspections loaded: ${rows.length}`);
  return rows.length;
}

if (isMain(import.meta.url)) {
  loadInspections().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
