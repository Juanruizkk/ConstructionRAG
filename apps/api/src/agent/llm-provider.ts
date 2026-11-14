export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}
export interface ToolCall { id: string; name: string; arguments: string }
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}
export interface AssistantTurn { content: string; toolCalls: ToolCall[] }

export interface LLMProvider {
  readonly name: string;
  complete(messages: ChatMessage[], tools: ToolSpec[]): Promise<AssistantTurn>;
}
