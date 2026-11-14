import { createClient, InspectionRepository, ViolationRepository } from '@ssi/db';
import { SCOPE } from '../../config.js';
import { iteratePages, chunk } from '../dol-client.js';
import { isMain } from '../is-main.js';
import { toViolation } from '../mappers/violation.mapper.js';

const FIELDS = [
  'activity_nr', 'citation_id', 'delete_flag', 'standard', 'viol_type', 'current_penalty',
  'initial_penalty', 'nr_instances', 'nr_exposed', 'gravity', 'issuance_date', 'abate_date',
  'final_order_date',
].join(',');

export async function loadViolations(activityNrs?: number[]): Promise<number> {
  const { db, queryClient } = createClient();
  const inspections = new InspectionRepository(db);
  const repo = new ViolationRepository(db);
  const ids = activityNrs ?? await inspections.allActivityNrs();
  let total = 0;
  try {
    for (const batch of chunk(ids, SCOPE.batchSize)) {
      const filter = { field: 'activity_nr', operator: 'in', value: batch };
      for await (const page of iteratePages('violation', filter, SCOPE.pageLimit, FIELDS)) {
        const rows = page.map(toViolation).filter((v): v is NonNullable<typeof v> => v !== null);
        for (const part of chunk(rows, 1000)) await repo.upsertMany(part);
        total += rows.length;
      }
    }
  } catch (e) {
    console.warn(`violations fetch stopped early (partial): ${e instanceof Error ? e.message : String(e)}`);
  }
  await queryClient.end();
  console.log(`violations loaded: ${total}`);
  return total;
}

if (isMain(import.meta.url)) {
  loadViolations().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
