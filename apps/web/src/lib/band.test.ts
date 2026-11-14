import { describe, expect, it } from 'vitest';
import { band } from './band.js';

describe('band', () => {
  it('maps risk_score to a band', () => {
    expect(band(70)).toBe('HIGH');
    expect(band(40)).toBe('MEDIUM');
    expect(band(10)).toBe('LOW');
    expect(band(0)).toBe('NONE');
    expect(band(null)).toBe('NONE');
  });
});
