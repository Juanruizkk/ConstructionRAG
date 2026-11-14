import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, '../../.env') });

const { GroqProvider, buildTools, runAgent } = await import('@ssi/api');
const { loadFacts } = await import('./facts.js');
const { buildCases } = await import('./cases.js');
const { scoreCase } = await import('./score.js');
type CaseResult = import('./score.js').CaseResult;

async function main() {
  const facts = await loadFacts();
  const cases = buildCases(facts);
  const provider = new GroqProvider();
  const results: CaseResult[] = [];

  for (const [i, c] of cases.entries()) {
    const tools = buildTools(facts.bidId);
    const out = await runAgent({ provider, tools, bidName: facts.bidName, userMessage: c.message });
    const r = scoreCase(c, out, facts);
    results.push(r);
    const mark = r.answerOk && r.toolsOk && r.groundingOk ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${r.id.padEnd(22)} answer=${r.answerOk} tools=${r.toolsOk} grounding=${r.groundingOk}  (${r.detail})`);
    // Spread token usage under Groq's free-tier TPM limit.
    if (i < cases.length - 1) await new Promise((res) => setTimeout(res, 8000));
  }

  const pct = (p: (r: CaseResult) => boolean) => Math.round((results.filter(p).length / results.length) * 100);
  const md = [
    `# Eval results (${provider.name})`,
    '',
    `Run against bid "${facts.bidName}" on the loaded dataset.`,
    '',
    `- Cases: ${results.length}`,
    `- Answer accuracy: ${pct((r) => r.answerOk)}%`,
    `- Tool-call correctness: ${pct((r) => r.toolsOk)}%`,
    `- Citation grounding: ${pct((r) => r.groundingOk)}%`,
    '',
    '| id | category | answer | tools | grounding |',
    '|---|---|---|---|---|',
    ...results.map((r) => `| ${r.id} | ${r.category} | ${r.answerOk ? '✅' : '❌'} | ${r.toolsOk ? '✅' : '❌'} | ${r.groundingOk ? '✅' : '❌'} |`),
  ].join('\n');
  await writeFile(join(here, '../results.md'), md, 'utf8');
  console.log('\nwrote evals/results.md');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
