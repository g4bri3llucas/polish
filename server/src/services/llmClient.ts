export interface LlmGenerateParams {
  systemInstruction: string;
  prompt: string;
  signal?: AbortSignal;
}

export interface LlmClient {
  generate(params: LlmGenerateParams): Promise<string>;
  generateStream(params: LlmGenerateParams): AsyncIterable<string>;
}