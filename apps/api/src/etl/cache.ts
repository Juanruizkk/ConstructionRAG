import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const RAW_DIR = join(process.cwd(), '..', '..', 'data', 'raw');

export function cacheKey(endpoint: string, filterObject: unknown, offset: number, fields?: string): string {
  const payload = JSON.stringify({ endpoint, filterObject, offset, fields: fields ?? null });
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return join(RAW_DIR, endpoint, `${hash}.json`);
}

export async function readCache<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function writeCache(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data), 'utf8');
}
