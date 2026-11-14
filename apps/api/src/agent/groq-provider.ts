import Groq from 'groq-sdk';
import type {
  AssistantTurn, ChatMessage, LLMProvider, ToolSpec,
} from './llm-provider.js';

const MODEL = 'llama-3.3-70b-versatile';

export class GroqProvider implements LLMProvider {
  readonly name = `groq:${MODEL}`;
  private client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  async complete(messages: ChatMessage[], tools: ToolSpec[]): Promise<AssistantTurn> {
    const res = await this.client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls
          ? { tool_calls: m.toolCalls.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: t.arguments } })) }
          : {}),
      })) as never,
      tools: tools.length
        ? tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
        : undefined,
      tool_choice: tools.length ? 'auto' : undefined,
    });
    const choice = res.choices[0]!.message;
    return {
      content: choice.content ?? '',
      toolCalls: (choice.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
    };
  }
}
