import type { NewInspection } from '@ssi/db';

const asInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const asDate = (v: unknown): string | null =>
  typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null;

export function toInspection(r: Record<string, unknown>): NewInspection {
  // reporting_id starting with a digit 0-4 is Federal; state plans use other prefixes.
  const reporting = String(r['reporting_id'] ?? '');
  return {
    activityNr: Number(r['activity_nr']),
    estabNameRaw: (r['estab_name'] as string) ?? null,
    siteAddress: (r['site_address'] as string) ?? null,
    siteCity: (r['site_city'] as string) ?? null,
    siteState: (r['site_state'] as string) ?? null,
    siteZip: (r['site_zip'] as string) ?? null,
    naicsCode: (r['naics_code'] as string) ?? null,
    inspType: (r['insp_type'] as string) ?? null,
    inspScope: (r['insp_scope'] as string) ?? null,
    ownerType: (r['owner_type'] as string) ?? null,
    isStatePlan: reporting !== '' ? !/^0[0-4]/.test(reporting) : null,
    unionStatus: (r['union_status'] as string) ?? null,
    safetyConst: (r['safety_const'] as string) ?? null,
    nrInEstab: asInt(r['nr_in_estab']),
    openDate: asDate(r['open_date']),
    closeCaseDate: asDate(r['close_case_date']),
  };
}
