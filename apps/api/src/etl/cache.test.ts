import { describe, expect, it } from 'vitest';
import { cacheKey } from './cache.js';

describe('cacheKey', () => {
  it('is deterministic for the same inputs', () => {
    const a = cacheKey('violation', { field: 'activity_nr', operator: 'in', value: [1, 2] }, 0);
    const b = cacheKey('violation', { field: 'activity_nr', operator: 'in', value: [1, 2] }, 0);
    expect(a).toBe(b);
  });
  it('changes when offset changes', () => {
    const a = cacheKey('violation', { x: 1 }, 0);
    const b = cacheKey('violation', { x: 1 }, 10_000);
    expect(a).not.toBe(b);
  });
});
