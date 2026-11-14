import { API_BASE, env } from '../config.js';
import { cacheKey, readCache, writeCache } from './cache.js';

type FilterObject = unknown;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Polite client-side throttle to stay under the DOL per-window request cap.
const MIN_GAP_MS = 1500;
let lastRequestAt = 0;
async function throttle() {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/** One page: cached by (endpoint, filter, offset). Retries on 429/5xx with backoff. */
async function fetchPage(
  endpoint: string,
  filterObject: FilterObject | undefined,
  offset: number,
  limit: number,
  fields?: string,
): Promise<Record<string, unknown>[]> {
  const path = cacheKey(endpoint, filterObject ?? null, offset, fields);
  const cached = await readCache<Record<string, unknown>[]>(path);
  if (cached) return cached;

  const url = new URL(`${API_BASE}/get/osha/${endpoint}/json`);
  url.searchParams.set('X-API-KEY', env.API_KEY_ODP);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (fields) url.searchParams.set('fields', fields);
  if (filterObject) url.searchParams.set('filter_object', JSON.stringify(filterObject));

  let attempt = 0;
  for (;;) {
    await throttle();
    const res = await fetch(url);
    if (res.ok) {
      const body = (await res.json()) as { data?: Record<string, unknown>[] };
      const rows = body.data ?? [];
      await writeCache(path, rows);
      return rows;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 8) {
      await sleep(Math.min(2 ** attempt * 500, 30_000));
      attempt += 1;
      continue;
    }
    throw new Error(`DOL ${endpoint} offset=${offset} -> ${res.status} ${await res.text()}`);
  }
}

/** Fetch ALL rows for a filter, paginating by offset until a short page. */
export async function fetchAll(
  endpoint: string,
  filterObject: FilterObject | undefined,
  limit: number,
  fields?: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(endpoint, filterObject, offset, limit, fields);
    out.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}
