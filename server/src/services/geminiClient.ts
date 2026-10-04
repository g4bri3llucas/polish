import {
  ApiError,
  GoogleGenAI,
  type GenerateContentConfig,
} from '@google/genai';
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

function emptyResponseError(): AppError {
  return new AppError(
    502,
    'LLM_EMPTY_RESPONSE',
    'O serviço de IA não retornou nenhum conteúdo.',
  );
}

export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  private buildConfig(params: LlmGenerateParams): GenerateContentConfig {
    // A chamada é cancelada por tempo esgotado OU quando quem chamou desiste
    // (por exemplo, o navegador fechou a conexão).
    const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];

    if (params.signal !== undefined) {
      signals.push(params.signal);
    }

    return {
      systemInstruction: params.systemInstruction,
      temperature: TEMPERATURE,
      abortSignal: AbortSignal.any(signals),
    };
  }

  async generate(params: LlmGenerateParams): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: params.prompt,
        config: this.buildConfig(params),
      });

      const text = response.text?.trim();

      if (text === undefined || text === '') {
        throw emptyResponseError();
      }

      return text;
    } catch (error) {
      throw toAppError(error);
    }
  }

  async *generateStream(params: LlmGenerateParams): AsyncGenerator<string> {
    try {
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        contents: params.prompt,
        config: this.buildConfig(params),
      });

      let hasContent = false;

      for await (const chunk of stream) {
        const text = chunk.text;

        if (text !== undefined && text !== '') {
          hasContent = true;
          yield text;
        }
      }

      if (!hasContent) {
        throw emptyResponseError();
      }
    } catch (error) {
      throw toAppError(error);
    }
  }
}