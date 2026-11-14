const SUFFIXES = new Set([
  'INC', 'LLC', 'LLP', 'LP', 'CO', 'CORP', 'CORPORATION', 'COMPANY', 'LTD', 'PC', 'PLLC', 'DBA', 'THE',
]);

/** Normalize a raw establishment name: uppercase, strip punctuation, drop legal suffixes. */
export function normalizeName(raw: string): string {
  let s = (raw ?? '').toUpperCase();
  s = s.replace(/\./g, '');          // keep acronyms intact: "A.B.C." -> "ABC"
  s = s.replace(/&/g, ' AND ');
  s = s.replace(/[^A-Z0-9 ]+/g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean).filter((t) => !SUFFIXES.has(t));
  return tokens.join(' ').trim();
}
