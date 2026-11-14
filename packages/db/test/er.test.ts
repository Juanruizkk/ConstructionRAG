import { describe, expect, it } from 'vitest';
import { normalizeName } from '../src/er/normalize.js';
import { distinctiveTokensMatch } from '../src/er/tokens.js';

describe('normalizeName', () => {
  it('uppercases, strips punctuation and legal suffixes', () => {
    expect(normalizeName('A.B.C. Roofing, LLC')).toBe('ABC ROOFING');
    expect(normalizeName('Smith & Sons Construction Inc.')).toBe('SMITH AND SONS CONSTRUCTION');
    expect(normalizeName('  The  XYZ   Co ')).toBe('XYZ');
  });
});

describe('distinctiveTokensMatch', () => {
  it('merges on a shared distinctive token', () => {
    expect(distinctiveTokensMatch('ABC ROOFING', 'ABC ROOFING AND SIDING')).toBe(true);
  });
  it('does not merge names sharing only industry words', () => {
    expect(distinctiveTokensMatch('ABC ROOFING', 'XYZ ROOFING')).toBe(false);
  });
  it('tolerates typos on tokens of length >= 4', () => {
    expect(distinctiveTokensMatch('SMITH BUILDERS', 'SMTIH BUILDERS')).toBe(true);
  });
  it('does not tolerate a 1-letter change on a short acronym', () => {
    expect(distinctiveTokensMatch('ABC CONSTRUCTION', 'ABD CONSTRUCTION')).toBe(false);
  });
});
