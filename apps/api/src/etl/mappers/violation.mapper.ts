import type { NewViolation } from '@ssi/db';

const asNum = (v: unknown): string | null => {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
};
const asInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const asDate = (v: unknown): string | null =>
  typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null;

export function toViolation(r: Record<string, unknown>): NewViolation | null {
  if (String(r['delete_flag'] ?? '') === 'X') return null; // drop deleted
  return {
    activityNr: Number(r['activity_nr']),
    citationId: String(r['citation_id']),
    standard: (r['standard'] as string) ?? null,
    violType: (r['viol_type'] as string) ?? null, // S|W|R|O|U
    currentPenalty: asNum(r['current_penalty']),
    initialPenalty: asNum(r['initial_penalty']),
    nrInstances: asInt(r['nr_instances']),
    nrExposed: asInt(r['nr_exposed']),
    gravity: asInt(r['gravity']),
    issuanceDate: asDate(r['issuance_date']),
    abateDate: asDate(r['abate_date']),
    finalOrderDate: asDate(r['final_order_date']),
  };
}
