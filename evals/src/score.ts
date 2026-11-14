import type { AgentOutput } from '@ssi/api';
import type { EvalCase } from './cases.js';
import type { Facts } from './facts.js';

export interface CaseResult {
  id: string;
  category: string;
  answerOk: boolean;
  toolsOk: boolean;
  groundingOk: boolean;
  detail: string;
}

/** Citation grounding: every activity_nr / summary_nr the model emits must appear in a captured citation. */
export function groundingOk(out: AgentOutput): boolean {
  const cited = new Set<number>();
  for (const c of out.citations) {
    if (c.activity_nr != null) cited.add(Number(c.activity_nr));
    if (c.summary_nr != null) cited.add(Number(c.summary_nr));
  }
  const mentioned = out.answer.match(/\b\d{7,10}\b/g)?.map(Number) ?? [];
  return mentioned.every((n) => cited.has(n));
}

export function scoreCase(c: EvalCase, out: AgentOutput, f: Facts): CaseResult {
  const traceNames = new Set(out.toolTrace.map((t) => t.name));
  const toolsOk = c.expectedTools.every((t) => traceNames.has(t));
  const { ok, detail } = c.check(out, f);
  return { id: c.id, category: c.category, answerOk: ok, toolsOk, groundingOk: groundingOk(out), detail };
}
