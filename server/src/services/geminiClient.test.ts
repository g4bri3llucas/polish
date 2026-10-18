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
    const client = new GeminiClient('chave', 'modelo-x');

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
    const client = new GeminiClient('chave', 'modelo');

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('LLM_EMPTY_RESPONSE');
  });

  it('maps a Gemini 429 to LLM_RATE_LIMITED', async () => {
    mocks.generateContent.mockRejectedValue(new ApiError({ message: 'quota', status: 429 }));
    const client = new GeminiClient('chave', 'modelo');

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('LLM_RATE_LIMITED');
  });

  it('maps other Gemini errors (like 503) to LLM_UNAVAILABLE', async () => {
    mocks.generateContent.mockRejectedValue(new ApiError({ message: 'high demand', status: 503 }));
    const client = new GeminiClient('chave', 'modelo');

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('LLM_UNAVAILABLE');
  });

  it('maps timeouts and aborts to LLM_TIMEOUT', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    mocks.generateContent.mockRejectedValue(timeout);
    const client = new GeminiClient('chave', 'modelo');

    const error = await errorFrom(client.generate(params));

    expect(error.statusCode).toBe(504);
    expect(error.code).toBe('LLM_TIMEOUT');
  });

  it('maps unknown errors to LLM_UNAVAILABLE without leaking their message', async () => {
    mocks.generateContent.mockRejectedValue(new Error('segredo interno'));
    const client = new GeminiClient('chave', 'modelo');

    const error = await errorFrom(client.generate(params));

    expect(error.code).toBe('LLM_UNAVAILABLE');
    expect(error.message).not.toContain('segredo interno');
  });
});

describe('GeminiClient.generateStream', () => {
  it('yields only non-empty chunks', async () => {
    mocks.generateContentStream.mockResolvedValue(streamOf('a', undefined, '', 'b'));
    const client = new GeminiClient('chave', 'modelo');

    await expect(collect(client.generateStream(params))).resolves.toEqual(['a', 'b']);
  });

  it('fails with LLM_EMPTY_RESPONSE when the stream has no text', async () => {
    mocks.generateContentStream.mockResolvedValue(streamOf(undefined, ''));
    const client = new GeminiClient('chave', 'modelo');

    const error = await errorFrom(collect(client.generateStream(params)));

    expect(error.code).toBe('LLM_EMPTY_RESPONSE');
  });

  it('maps a failure to start the stream', async () => {
    mocks.generateContentStream.mockRejectedValue(new ApiError({ message: 'quota', status: 429 }));
    const client = new GeminiClient('chave', 'modelo');

    const error = await errorFrom(collect(client.generateStream(params)));

    expect(error.code).toBe('LLM_RATE_LIMITED');
  });
});