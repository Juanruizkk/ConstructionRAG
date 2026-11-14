import { createClient, InspectionRepository, AccidentRepository } from '@ssi/db';
import { SCOPE } from '../../config.js';
import { iteratePages, chunk } from '../dol-client.js';
import { isMain } from '../is-main.js';
import { reassemble } from '../narratives.js';

/**
 * Cascade: in-scope activity_nr -> accident_injury (by rel_insp_nr) -> summary_nr set
 * -> accident + accident_abstract (by summary_nr). Insert-as-you-go; partial-tolerant.
 */
export async function loadAccidents(): Promise<void> {
  const { db, queryClient } = createClient();
  const inspections = new InspectionRepository(db);
  const repo = new AccidentRepository(db);
  const inScope = new Set(await inspections.allActivityNrs());

  const injuryFields = [
    'summary_nr', 'rel_insp_nr', 'degree_of_inj', 'nature_of_inj', 'part_of_body',
    'fat_cause', 'fall_ht', 'fall_distance', 'age', 'sex',
  ].join(',');

  // 1) injuries whose employer inspection is in scope
  const injuries: Record<string, unknown>[] = [];
  let orphans = 0;
  try {
    for (const batch of chunk([...inScope], SCOPE.batchSize)) {
      const filter = { field: 'rel_insp_nr', operator: 'in', value: batch };
      for await (const page of iteratePages('accident_injury', filter, SCOPE.pageLimit, injuryFields)) {
        injuries.push(...page);
      }
    }
  } catch (e) {
    console.warn(`accident_injury fetch stopped early (partial): ${e instanceof Error ? e.message : String(e)}`);
  }
  const kept = injuries.filter((i) => {
    const ok = inScope.has(Number(i['rel_insp_nr']));
    if (!ok) orphans += 1;
    return ok;
  });
  const summaryNrs = [...new Set(kept.map((i) => Number(i['summary_nr'])))];

  // 2) accident headers + abstracts for those summary_nrs
  const accRows: Record<string, unknown>[] = [];
  const absRows: Record<string, unknown>[] = [];
  const accFields = ['summary_nr', 'event_date', 'event_desc', 'project_type', 'build_stories', 'nonbuild_ht', 'fatality', 'abstract_text'].join(',');
  try {
    for (const batch of chunk(summaryNrs, SCOPE.batchSize)) {
      const filter = { field: 'summary_nr', operator: 'in', value: batch };
      for await (const page of iteratePages('accident', filter, SCOPE.pageLimit, accFields)) accRows.push(...page);
      for await (const page of iteratePages('accident_abstract', filter, SCOPE.pageLimit)) absRows.push(...page);
    }
  } catch (e) {
    console.warn(`accident fetch stopped early (partial): ${e instanceof Error ? e.message : String(e)}`);
  }
  const narratives = reassemble(absRows);

  await repo.upsertAccidents(accRows.map((r) => {
    const sn = Number(r['summary_nr']);
    const reassembled = narratives.get(sn) ?? '';
    const apiAbstract = String(r['abstract_text'] ?? '');
    // A3: keep the fuller of the reassembled abstract vs the API's own abstract_text.
    const narrative = reassembled.length >= apiAbstract.length ? reassembled : apiAbstract;
    return {
      summaryNr: sn,
      eventDate: typeof r['event_date'] === 'string' ? (r['event_date'] as string).slice(0, 10) : null,
      eventDesc: (r['event_desc'] as string) ?? null,
      narrative: narrative || null,
      projectType: (r['project_type'] as string) ?? null,
      buildStories: Number(r['build_stories']) || null,
      nonbuildHt: Number(r['nonbuild_ht']) || null,
      fatalityFlag: String(r['fatality'] ?? '') === 'X',
    };
  }));
  await repo.insertInjuries(kept.map((r) => ({
    summaryNr: Number(r['summary_nr']),
    relInspNr: Number(r['rel_insp_nr']),
    degreeOfInj: (r['degree_of_inj'] as string) ?? null,
    natureOfInj: (r['nature_of_inj'] as string) ?? null,
    partOfBody: (r['part_of_body'] as string) ?? null,
    faultCause: (r['fat_cause'] as string) ?? null,
    fallHt: Number(r['fall_ht']) || null,
    fallDistance: Number(r['fall_distance']) || null,
    age: Number(r['age']) || null,
    sex: (r['sex'] as string) ?? null,
  })));

  await queryClient.end();
  console.log(`accidents: ${accRows.length}, injuries: ${kept.length}, orphans_dropped: ${orphans}`);
}

if (isMain(import.meta.url)) {
  loadAccidents().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
