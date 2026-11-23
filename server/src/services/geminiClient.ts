import {
  ApiError,
  GoogleGenAI,
  type GenerateContentConfig,
} from '@google/genai';
import { setTimeout as sleep } from 'node:timers/promises';
import { AppError } from '../errors/AppError';
import type { LlmClient, LlmGenerateParams } from './llmClient';

const REQUEST_TIMEOUT_MS = 60_000;
const TEMPERATURE = 0.4;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000];
const DEFAULT_FIRST_CHUNK_TIMEOUT_MS = 15_000;

function timeoutError(): AppError {
  return new AppError(
    504,
    'LLM_TIMEOUT',
    'O serviço de IA demorou demais para responder.',
  );
}

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

    if (error.status === 503) {
      return new AppError(
        503,
        'LLM_OVERLOADED',
        'O serviço de IA está sobrecarregado agora. Tente novamente em instantes.',
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
    return timeoutError();
  }

  console.error('Erro inesperado ao chamar o Gemini:', error);

  return new AppError(
    502,
    'LLM_UNAVAILABLE',
    'O serviço de IA não está disponível no momento.',
  );
}

function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}

function emptyResponseError(): AppError {
  return new AppError(
    502,
    'LLM_EMPTY_RESPONSE',
    'O serviço de IA não retornou nenhum conteúdo.',
  );
}

export interface GeminiClientOptions {
  retryDelaysMs?: readonly number[];
  firstChunkTimeoutMs?: number;
}

export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly retryDelaysMs: readonly number[];
  private readonly firstChunkTimeoutMs: number;

  constructor(apiKey: string, model: string, options: GeminiClientOptions = {}) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.firstChunkTimeoutMs =
      options.firstChunkTimeoutMs ?? DEFAULT_FIRST_CHUNK_TIMEOUT_MS;
  }

  private buildConfig(
    params: LlmGenerateParams,
    stallSignal?: AbortSignal,
  ): GenerateContentConfig {
    const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];

    if (params.signal !== undefined) {
      signals.push(params.signal);
    }

    if (stallSignal !== undefined) {
      signals.push(stallSignal);
    }

    return {
      systemInstruction: params.systemInstruction,
      temperature: TEMPERATURE,
      abortSignal: AbortSignal.any(signals),
    };
  }

  private canRetry(error: unknown, attempt: number): boolean {
    return attempt < this.retryDelaysMs.length && isRetryable(error);
  }

  private hasRetriesLeft(attempt: number): boolean {
    return attempt < this.retryDelaysMs.length;
  }

  private async waitBeforeRetry(attempt: number, signal?: AbortSignal): Promise<void> {
    try {
      await sleep(this.retryDelaysMs[attempt], undefined, { signal });
    } catch (error) {
      throw toAppError(error);
    }
  }

  async generate(params: LlmGenerateParams): Promise<string> {
    for (let attempt = 0; ; attempt++) {
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
        if (!this.canRetry(error, attempt)) {
          throw toAppError(error);
        }
      }

      await this.waitBeforeRetry(attempt, params.signal);
    }
  }

  async *generateStream(params: LlmGenerateParams): AsyncGenerator<string> {
    for (let attempt = 0; ; attempt++) {
      let hasContent = false;
      const stall = new AbortController();
      const stallTimer = setTimeout(() => {
        stall.abort();
      }, this.firstChunkTimeoutMs);

      try {
        const stream = await this.ai.models.generateContentStream({
          model: this.model,
          contents: params.prompt,
          config: this.buildConfig(params, stall.signal),
        });

        for await (const chunk of stream) {
          const text = chunk.text;

          if (text !== undefined && text !== '') {
            hasContent = true;
            clearTimeout(stallTimer);
            yield text;
          }
        }

        if (!hasContent) {
          throw emptyResponseError();
        }

        return;
      } catch (error) {
        if (hasContent) {
          throw toAppError(error);
        }

        if (stall.signal.aborted) {
          if (!this.hasRetriesLeft(attempt)) {
            throw timeoutError();
          }
        } else if (!this.canRetry(error, attempt)) {
          throw toAppError(error);
        }
      } finally {
        clearTimeout(stallTimer);
      }

      await this.waitBeforeRetry(attempt, params.signal);
    }
  }
}