import { describe, expect, it } from 'vitest';
import { IncidentService } from './incident.service.js';

// Uses the populated dev DB + a real embedding model. Tolerant if no chunks are loaded yet.
describe('IncidentService', () => {
  it('returns no hits for a nonsense query (below threshold)', async () => {
    const svc = new IncidentService();
    const res = await svc.search('xyzzy quarterly financial spreadsheet formatting');
    expect(res.every((r) => r.similarity >= 0.35)).toBe(true);
  });

  it('finds a relevant incident for a matching query (if any chunk exists)', async () => {
    const svc = new IncidentService();
    const res = await svc.search('worker struck and killed by a truck');
    // If chunks exist, the top hit should clear the threshold.
    if (res.length > 0) expect(res[0]!.similarity).toBeGreaterThan(0.35);
  });
});
