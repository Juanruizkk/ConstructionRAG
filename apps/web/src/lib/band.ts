export type Band = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export function band(score: number | null): Band {
  if (score == null || score <= 0) return 'NONE';
  if (score >= 60) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}
