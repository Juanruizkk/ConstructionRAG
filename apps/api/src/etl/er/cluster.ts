import { COHESION_TRGM, distinctiveTokensMatch } from '@ssi/db';

/** Dice coefficient over padded trigrams (mirrors pg_trgm similarity closely enough for cohesion). */
export function trigramSim(a: string, b: string): number {
  const grams = (s: string) => {
    const p = `  ${s} `;
    const g = new Set<string>();
    for (let i = 0; i < p.length - 2; i++) g.add(p.slice(i, i + 3));
    return g;
  };
  const A = grams(a);
  const B = grams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  return (2 * inter) / (A.size + B.size || 1);
}

class DSU {
  private parent: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number { return this.parent[x] === x ? x : (this.parent[x] = this.find(this.parent[x]!)); }
  union(a: number, b: number) { this.parent[this.find(a)] = this.find(b); }
}

/**
 * Cluster normalized names given candidate pairs (already pre-filtered by pg_trgm % within a state).
 * Confirms each pair with distinctiveTokensMatch, then validates cohesion vs the canonical (anti-chaining).
 * Returns clusters as arrays of indices into `norms`.
 */
export function clusterFromPairs(
  norms: string[],
  weights: number[], // total occurrences per norm (to pick the canonical)
  candidatePairs: Array<[number, number]>,
): number[][] {
  const dsu = new DSU(norms.length);
  for (const [i, j] of candidatePairs) {
    if (distinctiveTokensMatch(norms[i]!, norms[j]!)) dsu.union(i, j);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < norms.length; i++) {
    const r = dsu.find(i);
    const arr = groups.get(r) ?? [];
    arr.push(i);
    groups.set(r, arr);
  }
  const result: number[][] = [];
  for (const idxs of groups.values()) {
    const canonical = idxs.reduce((best, i) => (weights[i]! > weights[best]! ? i : best), idxs[0]!);
    const kept: number[] = [];
    for (const i of idxs) {
      if (i === canonical
        || distinctiveTokensMatch(norms[i]!, norms[canonical]!)
        || trigramSim(norms[i]!, norms[canonical]!) >= COHESION_TRGM) {
        kept.push(i);
      } else {
        result.push([i]); // split off chained member
      }
    }
    result.push(kept);
  }
  return result;
}
