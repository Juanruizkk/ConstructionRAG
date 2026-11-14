import { GENERIC_TOKENS } from './config.js';

// Damerau (optimal string alignment) distance: adjacent transpositions count as 1 edit,
// so "SMITH" vs "SMTIH" is distance 1 (a real-world typo), not 2.
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
      }
    }
  }
  return dp[a.length]![b.length]!;
}

/** Tokens that identify the business (drop industry/generic words). */
export function distinctiveTokens(norm: string): string[] {
  return norm.split(/\s+/).filter((t) => t && !GENERIC_TOKENS.has(t));
}

/** Two normalized names "match" if they share a distinctive token (exact, or 1 edit for tokens >= 4 chars). */
export function distinctiveTokensMatch(aNorm: string, bNorm: string): boolean {
  const a = distinctiveTokens(aNorm);
  const b = distinctiveTokens(bNorm);
  for (const ta of a) {
    for (const tb of b) {
      if (ta === tb) return true;
      if (ta.length >= 4 && tb.length >= 4 && editDistance(ta, tb) <= 1) return true;
    }
  }
  return false;
}
