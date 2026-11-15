import { describe, expect, it } from 'vitest';
import { parseStandardToCfr } from './parse-standard.js';

describe('parseStandardToCfr', () => {
  it('parses packed OSHA codes', () => {
    expect(parseStandardToCfr('19260501 B13')).toBe('1926.501');
    expect(parseStandardToCfr('19260102 A01')).toBe('1926.102');
    expect(parseStandardToCfr('19261053 B01')).toBe('1926.1053');
    expect(parseStandardToCfr('19101200 E01')).toBe('1910.1200');
  });
  it('parses already-dotted codes and drops sub-clauses', () => {
    expect(parseStandardToCfr('1926.501(b)(13)')).toBe('1926.501');
    expect(parseStandardToCfr('1910.1200')).toBe('1910.1200');
  });
  it('returns null for non-CFR (state-plan / general-duty) codes', () => {
    expect(parseStandardToCfr('1509(A)')).toBeNull();
    expect(parseStandardToCfr('3395(I)')).toBeNull();
    expect(parseStandardToCfr('5A0001')).toBeNull();
  });
});
