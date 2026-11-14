import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runAgent } from './loop.js';
import type { AssistantTurn, LLMProvider } from './llm-provider.js';
import type { Tool } from '../tools/types.js';

const echoTool: Tool = {
  name: 'echo',
  description: 'echo',
  schema: z.object({ text: z.string() }),
  async execute(a) { return { data: { echoed: a.text }, citations: [] }; },
};

class ScriptedProvider implements LLMProvider {
  name = 'fake';
  private turns: AssistantTurn[];
  constructor(turns: AssistantTurn[]) { this.turns = turns; }
  async complete(): Promise<AssistantTurn> { return this.turns.shift()!; }
}

describe('runAgent', () => {
  it('executes a tool call then returns the final answer', async () => {
    const provider = new ScriptedProvider([
      { content: '', toolCalls: [{ id: '1', name: 'echo', arguments: '{"text":"hi"}' }] },
      { content: 'Done: hi', toolCalls: [] },
    ]);
    const res = await runAgent({ provider, tools: [echoTool], bidName: 'B', userMessage: 'go' });
    expect(res.answer).toBe('Done: hi');
    expect(res.toolTrace[0]!.name).toBe('echo');
  });

  it('feeds a zod validation error back and still finishes', async () => {
    const provider = new ScriptedProvider([
      { content: '', toolCalls: [{ id: '1', name: 'echo', arguments: '{"wrong":1}' }] },
      { content: 'Recovered', toolCalls: [] },
    ]);
    const res = await runAgent({ provider, tools: [echoTool], bidName: 'B', userMessage: 'go' });
    expect(res.answer).toBe('Recovered');
  });
});
