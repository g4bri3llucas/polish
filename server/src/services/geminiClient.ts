import { ApiError, GoogleGenAI } from '@google/genai';
import { AppError } from '../errors/AppError';
import type { LlmClient, LlmGenerateParams } from './llmClient';

const REQUEST_TIMEOUT_MS = 60_000;
const TEMPERATURE = 0.4;

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ApiError) {
    console.error(`Erro da API do Gemini (status ${error.status}):`, error.message);

    if (error.status === 429) {
      return new AppError(
        429,
        'LLM_RATE_LIMITED',
        'Muitas requisições ao serviço de IA. Tente novamente em instantes.',
      );
    }

    return new AppError(
      502,
      'LLM_UNAVAILABLE',
      'O serviço de IA não está disponível no momento.',
    );
  }

  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return new AppError(
      504,
      'LLM_TIMEOUT',
      'O serviço de IA demorou demais para responder.',
    );
  }

  console.error('Erro inesperado ao chamar o Gemini:', error);

  return new AppError(
    502,
    'LLM_UNAVAILABLE',
    'O serviço de IA não está disponível no momento.',
  );
}

export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generate(params: LlmGenerateParams): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: TEMPERATURE,
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      });

      const text = response.text?.trim();

      if (text === undefined || text === '') {
        throw new AppError(
          502,
          'LLM_EMPTY_RESPONSE',
          'O serviço de IA não retornou nenhum conteúdo.',
        );
      }

      return text;
    } catch (error) {
      throw toAppError(error);
    }
  }
}