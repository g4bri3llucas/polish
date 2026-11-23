import { ApiError } from '@google/genai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/AppError';
import { GeminiClient } from './geminiClient';


const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
}));


vi.mock('@google/genai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@google/genai')>();

  return {
    ...original,
    GoogleGenAI: class {
      models = {
        generateContent: mocks.generateContent,
        generateContentStream: mocks.generateContentStream,
      };
    },
  };
});

const params = { systemInstruction: 'regras', prompt: 'texto' };
const noRetry = { retryDelaysMs: [] };
const fastRetry = { retryDelaysMs: [0, 0] };
const overloaded = () => new ApiError({ message: 'high demand', status: 503 });

async function* streamOf(...texts: (string | undefined)[]): AsyncGenerator<{ text: string | undefined }> {
  await Promise.resolve();
  for (const text of texts) {
    yield { text };
  }
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];

  for await (const item of iterable) {
    result.push(item);
  }

  return result;
}

async function errorFrom(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }
    throw error;
  }

  throw new Error('Era esperado um AppError, mas nada foi lançado.');
}

beforeEach(() => {
  mocks.generateContent.mockReset();
  mocks.generateContentStream.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('GeminiClient.generate', () => {
  it('returns the trimmed text and sends model, prompt and system instruction', async () => {
    mocks.generateContent.mockResolvedValue({ text: '  resposta  ' });
    const client = new GeminiClient('chave', 'modelo-x', noRetry);

    await expect(client.generate(params)).resolves.toBe('resposta');

    expect(mocks.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-x',
        contents: 'texto',
        config: expect.objectContaining({ systemInstruction: 'regras' }) as unknown,
      }),
    );
  });

  it('maps an empty response to LLM_EMPTY_RESPONSE', async () => {
    mocks.generateContent.mockResolvedValue({ text: '   ' });
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('LLM_EMPTY_RESPONSE');
  });

  it('maps a Gemini 429 to LLM_RATE_LIMITED', async () => {
    mocks.generateContent.mockRejectedValue(new ApiError({ message: 'quota', status: 429 }));
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('LLM_RATE_LIMITED');
  });

  it('maps a Gemini 503 to LLM_OVERLOADED', async () => {
    mocks.generateContent.mockRejectedValue(overloaded());
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('LLM_OVERLOADED');
  });

  it('maps other Gemini errors to LLM_UNAVAILABLE', async () => {
    mocks.generateContent.mockRejectedValue(new ApiError({ message: 'internal', status: 500 }));
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('LLM_UNAVAILABLE');
  });

  it('retries when Gemini is overloaded and returns the next answer', async () => {
    mocks.generateContent
      .mockRejectedValueOnce(overloaded())
      .mockResolvedValueOnce({ text: 'resposta' });
    const client = new GeminiClient('chave', 'modelo', fastRetry);

    await expect(client.generate(params)).resolves.toBe('resposta');
    expect(mocks.generateContent).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last retry', async () => {
    mocks.generateContent.mockRejectedValue(overloaded());
    const client = new GeminiClient('chave', 'modelo', fastRetry);

    const error = await errorFrom(client.generate(params));

    expect(error.code).toBe('LLM_OVERLOADED');
    expect(mocks.generateContent).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 429', async () => {
    mocks.generateContent.mockRejectedValue(new ApiError({ message: 'quota', status: 429 }));
    const client = new GeminiClient('chave', 'modelo', fastRetry);

    await errorFrom(client.generate(params));

    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it('maps timeouts and aborts to LLM_TIMEOUT', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    mocks.generateContent.mockRejectedValue(timeout);
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(504);
    expect(error.code).toBe('LLM_TIMEOUT');
  });

  it('maps unknown errors to LLM_UNAVAILABLE without leaking their message', async () => {
    mocks.generateContent.mockRejectedValue(new Error('segredo interno'));
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(client.generate(params));

    expect(error.code).toBe('LLM_UNAVAILABLE');
    expect(error.message).not.toContain('segredo interno');
  });
});

describe('GeminiClient.generateStream', () => {
  it('yields only non-empty chunks', async () => {
    mocks.generateContentStream.mockResolvedValue(streamOf('a', undefined, '', 'b'));
    const client = new GeminiClient('chave', 'modelo', noRetry);

    await expect(collect(client.generateStream(params))).resolves.toEqual(['a', 'b']);
  });

  it('fails with LLM_EMPTY_RESPONSE when the stream has no text', async () => {
    mocks.generateContentStream.mockResolvedValue(streamOf(undefined, ''));
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(collect(client.generateStream(params)));

    expect(error.code).toBe('LLM_EMPTY_RESPONSE');
  });

  it('maps a failure to start the stream', async () => {
    mocks.generateContentStream.mockRejectedValue(new ApiError({ message: 'quota', status: 429 }));
    const client = new GeminiClient('chave', 'modelo', noRetry);

    const error = await errorFrom(collect(client.generateStream(params)));

    expect(error.code).toBe('LLM_RATE_LIMITED');
  });

  it('retries when the stream fails before the first chunk', async () => {
    async function* failsFirst(): AsyncGenerator<{ text: string }> {
      await Promise.resolve();
      throw overloaded();
    }

    mocks.generateContentStream
      .mockResolvedValueOnce(failsFirst())
      .mockResolvedValueOnce(streamOf('a', 'b'));
    const client = new GeminiClient('chave', 'modelo', fastRetry);

    await expect(collect(client.generateStream(params))).resolves.toEqual(['a', 'b']);
    expect(mocks.generateContentStream).toHaveBeenCalledTimes(2);
  });

  it('does not retry once a chunk was already sent', async () => {
    async function* failsMidway(): AsyncGenerator<{ text: string }> {
      await Promise.resolve();
      yield { text: 'a' };
      throw overloaded();
    }

    mocks.generateContentStream.mockResolvedValue(failsMidway());
    const client = new GeminiClient('chave', 'modelo', fastRetry);
    const received: string[] = [];

    const error = await errorFrom(
      (async () => {
        for await (const text of client.generateStream(params)) {
          received.push(text);
        }
      })(),
    );

    expect(received).toEqual(['a']);
    expect(error.code).toBe('LLM_OVERLOADED');
    expect(mocks.generateContentStream).toHaveBeenCalledTimes(1);
  });
});