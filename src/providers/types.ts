import { z } from "zod";

// OpenAI-compatible Chat Message Schema
export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "function"]),
  content: z.union([z.string(), z.array(z.any())]).nullable().optional(),
  name: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// OpenAI-compatible Chat Completion Request Schema
export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1, "Model must not be empty"),
  messages: z.array(ChatMessageSchema).min(1, "Messages array must not be empty"),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().min(1).optional(),
  stream: z.boolean().optional().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  user: z.string().optional(),
  response_format: z.object({ type: z.enum(["text", "json_object"]) }).optional(),
});
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

// OpenAI-compatible Response Types
export interface ChatCompletionChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
  };
  finish_reason: string | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

// Streaming Chunk Types
export interface ChatCompletionChunkChoice {
  index: number;
  delta: {
    role?: string;
    content?: string | null;
  };
  finish_reason: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

// Provider & Model Info
export interface ProviderModel {
  id: string;
  name: string;
  owned_by?: string;
  context_window?: number;
  supports_streaming: boolean;
}

export interface ModelListItem {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  provider: string;
}

// The core ProviderAdapter interface (SPI)
export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  listModels(): Promise<ProviderModel[]>;
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk>;
}
