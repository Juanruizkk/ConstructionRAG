import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ChatMessage, LLMProvider, ToolSpec } from './llm-provider.js';
import type { Citation, Tool } from '../tools/types.js';

const MAX_ITERS = 6;

const SYSTEM = (bidName: string) => `You are a construction safety assistant for a general contractor.
The current bid is "${bidName}". When the user says "my subs" call get_bid first.
RULES:
- Numbers (counts, penalties, fatalities, risk scores) MUST come from tool results. Never invent them.
- If the tools do not have the answer, say so plainly. Do not fabricate.
- Cite your sources: reference the activity_nr / incident returned by tools.
- If a contractor is not found, say "No OSHA record found — this does NOT mean the sub is safe."
- Data scope is construction (NAICS 23) in CA, TX and NY. If asked outside that, say so.
FORMATTING:
- Reply in clean GitHub-flavored Markdown (use tables for lists of subs, **bold** for key figures).
- Do NOT use footnote markers like 【0】 or [1]. Cite inline by naming the activity_nr or incident number in prose.`;

export interface AgentInput {
  provider: LLMProvider;
  tools: Tool[];
  bidName: string;
  userMessage: string;
  history?: ChatMessage[];
}
export interface AgentOutput {
  answer: string;
  citations: Citation[];
  toolTrace: { name: string; args: string }[];
}

function dedup(cits: Citation[]): Citation[] {
  const seen = new Set<string>();
  return cits.filter((c) => { const k = JSON.stringify(c); if (seen.has(k)) return false; seen.add(k); return true; });
}

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const toolSpecs: ToolSpec[] = input.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: zodToJsonSchema(t.schema, { target: 'openApi3' }) as Record<string, unknown>,
  }));
  const byName = new Map(input.tools.map((t) => [t.name, t]));
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM(input.bidName) },
    ...(input.history ?? []),
    { role: 'user', content: input.userMessage },
  ];
  const citations: Citation[] = [];
  const toolTrace: { name: string; args: string }[] = [];

  for (let i = 0; i < MAX_ITERS; i++) {
    const turn = await input.provider.complete(messages, toolSpecs);
    if (turn.toolCalls.length === 0) {
      return { answer: turn.content, citations: dedup(citations), toolTrace };
    }
    messages.push({ role: 'assistant', content: turn.content, toolCalls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      toolTrace.push({ name: call.name, args: call.arguments });
      const tool = byName.get(call.name);
      let resultContent: string;
      if (!tool) {
        resultContent = JSON.stringify({ error: `unknown tool ${call.name}` });
      } else {
        try {
          const parsed = tool.schema.parse(JSON.parse(call.arguments || '{}'));
          const result = await tool.execute(parsed);
          citations.push(...result.citations);
          resultContent = JSON.stringify(result.data);
        } catch (err) {
          // zod validation or tool runtime error → feed back so the model can self-correct.
          resultContent = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
      }
      messages.push({ role: 'tool', content: resultContent, toolCallId: call.id });
    }
  }
  const final = await input.provider.complete(
    [...messages, { role: 'user', content: 'Summarize your answer now using only the tool results above.' }],
    [],
  );
  return { answer: final.content, citations: dedup(citations), toolTrace };
}
