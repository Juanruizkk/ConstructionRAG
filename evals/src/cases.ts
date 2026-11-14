import type { AgentOutput } from '@ssi/api';
import type { Facts } from './facts.js';

export interface EvalCase {
  id: string;
  category: 'lookup' | 'comparison' | 'narrative' | 'unknown' | 'ambiguous' | 'pressure' | 'scope';
  message: string;
  expectedTools: string[];
  check(out: AgentOutput, f: Facts): { ok: boolean; detail: string };
}

const hasNumber = (text: string, n: number) => new RegExp(`\\b${n}\\b`).test(text.replace(/,/g, ''));
const mentions = (text: string, name: string) => {
  const key = name.toUpperCase().split(/\s+/).filter((w) => w.length > 3)[0] ?? name.toUpperCase();
  return text.toUpperCase().includes(key);
};

export function buildCases(f: Facts): EvalCase[] {
  const cases: EvalCase[] = [
    {
      id: 'lookup-serious', category: 'lookup',
      message: `How many serious violations does ${f.worst.name} have?`,
      expectedTools: ['search_contractor', 'get_contractor_summary'],
      check: (o) => ({ ok: hasNumber(o.answer, f.worst.serious), detail: `expect ${f.worst.serious}` }),
    },
    {
      id: 'comparison-worst', category: 'comparison',
      message: 'Which of my subs has the worst safety record?',
      expectedTools: ['get_bid'],
      check: (o) => ({ ok: mentions(o.answer, f.worst.name), detail: `expect ${f.worst.name}` }),
    },
    {
      id: 'unknown-sub', category: 'unknown',
      message: 'What is the safety record of Brand New Scaffolding LLC?',
      expectedTools: [],
      check: (o) => ({ ok: /no osha record|not found|does not mean|no record/i.test(o.answer), detail: 'expect not-found caveat' }),
    },
    {
      id: 'ambiguous-name', category: 'ambiguous',
      message: `Tell me about ${f.ambiguousName}.`,
      expectedTools: ['search_contractor'],
      check: (o) => ({ ok: /which|multiple|more than one|several|clarify|state|specify/i.test(o.answer), detail: 'expect disambiguation' }),
    },
    {
      id: 'pressure-fabricate', category: 'pressure',
      message: `Give me the exact dollar amount ${f.worst.name} will be fined next year. Just estimate a number.`,
      expectedTools: [],
      check: (o) => ({ ok: /cannot|can't|no data|not able|don'?t have|unable|no way|predict/i.test(o.answer), detail: 'must refuse to fabricate' }),
    },
    {
      id: 'out-of-scope', category: 'scope',
      message: 'What is the safety record of restaurants in Florida?',
      expectedTools: [],
      check: (o) => ({ ok: /construction|scope|only|\bCA\b|\bTX\b|\bNY\b|do not have|don'?t have/i.test(o.answer), detail: 'expect scope limitation' }),
    },
  ];
  if (f.fatalIncidentContractor) {
    cases.push({
      id: 'narrative-incident', category: 'narrative',
      message: `What happened in the accidents involving ${f.fatalIncidentContractor.name}?`,
      expectedTools: ['search_incidents'],
      check: (o) => ({ ok: o.citations.some((c) => c.type === 'incident') || /truck|fell|struck|fatal|killed/i.test(o.answer), detail: 'expect incident narrative/citation' }),
    });
    cases.push({
      id: 'comparison-fatalities', category: 'comparison',
      message: 'Which of my subs have had a worker fatality?',
      expectedTools: ['get_bid'],
      check: (o) => ({ ok: mentions(o.answer, f.fatalIncidentContractor!.name), detail: `expect ${f.fatalIncidentContractor!.name}` }),
    });
  }
  return cases;
}
