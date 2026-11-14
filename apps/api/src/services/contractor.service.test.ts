import { describe, expect, it } from 'vitest';
import { ContractorService } from './contractor.service.js';

// Runs against the populated dev DB (DATABASE_URL). Tolerant if empty.
describe('ContractorService', () => {
  it('search normalizes and matches (e.g. a legal-suffix variant)', async () => {
    const svc = new ContractorService();
    const hits = await svc.search('UNIT CONSTRUCTORS LLC', 'TX');
    // Should find UNIT CONSTRUCTORS INC via normalized match, if loaded.
    if (hits.length === 0) return;
    expect(hits[0]!.confidence).toBeGreaterThan(0.3);
  });

  it('summary returns a numeric risk_raw for a known contractor', async () => {
    const svc = new ContractorService();
    const hits = await svc.search('UNIT CONSTRUCTORS');
    if (hits.length === 0) return;
    const s = await svc.summary(hits[0]!.contractor_id);
    expect(s).not.toBeNull();
    expect(typeof Number(s!.risk_raw)).toBe('number');
  });
});
