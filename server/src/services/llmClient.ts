export interface LlmGenerateParams {
  systemInstruction: string;
  prompt: string;
}

export interface LlmClient {
  generate(params: LlmGenerateParams): Promise<string>;
}