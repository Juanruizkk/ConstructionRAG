import { pathToFileURL } from 'node:url';

/** True when this module is the process entrypoint (cross-platform, handles Windows paths + spaces). */
export function isMain(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return importMetaUrl === pathToFileURL(entry).href;
}
