export function reassemble(rows: Record<string, unknown>[]): Map<number, string> {
  const byId = new Map<number, { line: number; text: string }[]>();
  for (const r of rows) {
    const id = Number(r['summary_nr']);
    const line = Number(r['line_nr']) || 0;
    const text = String(r['abstract_text'] ?? '');
    const arr = byId.get(id) ?? [];
    arr.push({ line, text });
    byId.set(id, arr);
  }
  const out = new Map<number, string>();
  for (const [id, parts] of byId) {
    parts.sort((a, b) => a.line - b.line);
    out.set(id, parts.map((p) => p.text).join('').trim());
  }
  return out;
}
