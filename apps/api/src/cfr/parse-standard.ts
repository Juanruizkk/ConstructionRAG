/**
 * Map an OSHA citation `standard` to a 29 CFR section code, or null if it isn't a federal CFR code.
 * Examples:
 *   "19260501 B13"   -> "1926.501"   (packed: 4-digit part + 4-digit section)
 *   "1926.501(b)(13)" -> "1926.501"   (already dotted, drop sub-clauses)
 *   "19101200 E01"   -> "1910.1200"
 *   "1509(A)"        -> null          (NY state-plan code, not federal CFR)
 *   "5A0001"         -> null          (general duty clause, not a CFR section)
 */
export function parseStandardToCfr(standard: string): string | null {
  const s = (standard ?? '').trim();

  // Already dotted: 1926.501 / 1910.1200 / 1926.501(b)(13)
  const dotted = /^(19(?:26|10))\.(\d+)/.exec(s);
  if (dotted) return `${dotted[1]}.${dotted[2]}`;

  // Packed: first token is 8 digits = part(4) + section(4), e.g. "19260501" -> 1926.501
  const token = s.split(/[\s(]/)[0] ?? '';
  const packed = /^(\d{4})(\d{4})$/.exec(token);
  if (packed && (packed[1] === '1926' || packed[1] === '1910')) {
    return `${packed[1]}.${parseInt(packed[2]!, 10)}`;
  }

  return null;
}
