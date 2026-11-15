import type { NewInspection } from '@ssi/db';

const asDate = (v: unknown): string | null =>
  typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null;

export function toInspection(r: Record<string, unknown>): NewInspection {
  return {
    activityNr: Number(r['activity_nr']),
    estabNameRaw: (r['estab_name'] as string) ?? null,
    siteAddress: (r['site_address'] as string) ?? null,
    siteCity: (r['site_city'] as string) ?? null,
    siteState: (r['site_state'] as string) ?? null,
    siteZip: (r['site_zip'] as string) ?? null,
    naicsCode: (r['naics_code'] as string) ?? null,
    inspType: (r['insp_type'] as string) ?? null,
    openDate: asDate(r['open_date']),
  };
}
