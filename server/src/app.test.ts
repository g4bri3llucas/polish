import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from './config/limits';
import { AppError } from './errors/AppError';
import {
  VALID_RESUME,
  chunksOf,
  createFakeLlm,
  postJson,
  readSseEvents,
  startApp,
  type FakeLlm,
  type RunningApp,
} from './testing/testApp';

let app: RunningApp | undefined;

async function start(llm: FakeLlm): Promise<RunningApp> {
  app = await startApp(llm);
  return app;
}

beforeEach(() => {

  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
});

describe('GET /api/health', () => {
  it('responds with status ok', async () => {
    const { baseUrl } = await start(createFakeLlm());

    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

describe('unknown routes', () => {
  it('answer 404 in the standard error format', async () => {
    const { baseUrl } = await start(createFakeLlm());

    const response = await fetch(`${baseUrl}/api/nao-existe`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });
});

describe('POST /api/review', () => {
  it('returns the review text from the model', async () => {
    const llm = createFakeLlm({ generate: () => Promise.resolve('## Nota\n**80/100** — bom') });
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review', { resumeText: VALID_RESUME });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ review: '## Nota\n**80/100** — bom' });
    expect(llm.generateCalls[0]?.prompt).toContain(VALID_RESUME);
  });

  it('rejects an invalid body with details and never calls the model', async () => {
    const llm = createFakeLlm();
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review', { resumeText: 'curto' });
    const body = (await response.json()) as {
      error: { code: string; details: { field: string }[] };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.details[0]?.field).toBe('resumeText');
    expect(llm.generateCalls).toHaveLength(0);
  });

  it('answers 400 INVALID_JSON for a broken JSON body', async () => {
    const { baseUrl } = await start(createFakeLlm());

    const response = await postJson(baseUrl, '/api/review', '{"resumeText": ');
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_JSON');
  });

  it('answers 413 PAYLOAD_TOO_LARGE for a body above the limit', async () => {
    const { baseUrl } = await start(createFakeLlm());

    const response = await postJson(baseUrl, '/api/review', {
      resumeText: 'a'.repeat(200 * 1024),
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('maps an AppError from the model to its status code', async () => {
    const llm = createFakeLlm({
      generate: () =>
        Promise.reject(new AppError(502, 'LLM_UNAVAILABLE', 'O serviço de IA não está disponível.')),
    });
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review', { resumeText: VALID_RESUME });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(502);
    expect(body.error.code).toBe('LLM_UNAVAILABLE');
  });

  it('hides the details of unexpected errors', async () => {
    const llm = createFakeLlm({ generate: () => Promise.reject(new Error('segredo interno')) });
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review', { resumeText: VALID_RESUME });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain('INTERNAL_ERROR');
    expect(text).not.toContain('segredo interno');
  });
});

describe('POST /api/review/stream', () => {
  it('streams chunk events followed by done', async () => {
    const llm = createFakeLlm({ generateStream: () => chunksOf('Olá', ', mundo') });
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review/stream', { resumeText: VALID_RESUME });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(await readSseEvents(response)).toEqual([
      { event: 'chunk', data: { text: 'Olá' } },
      { event: 'chunk', data: { text: ', mundo' } },
      { event: 'done', data: {} },
    ]);
  });

  it('validates the body before opening the stream', async () => {
    const { baseUrl } = await start(createFakeLlm());

    const response = await postJson(baseUrl, '/api/review/stream', {});

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('answers with the proper HTTP status when the model fails before the first chunk', async () => {
    const llm = createFakeLlm({
      generateStream: async function* () {
        await Promise.resolve();
        throw new AppError(429, 'LLM_RATE_LIMITED', 'Muitas requisições ao serviço de IA.');
      },
    });
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review/stream', { resumeText: VALID_RESUME });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(body.error.code).toBe('LLM_RATE_LIMITED');
  });

  it('sends an error event when the model fails in the middle of the stream', async () => {
    const llm = createFakeLlm({
      generateStream: async function* () {
        await Promise.resolve();
        yield 'parcial';
        throw new AppError(504, 'LLM_TIMEOUT', 'O serviço de IA demorou demais.');
      },
    });
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review/stream', { resumeText: VALID_RESUME });

    expect(response.status).toBe(200);
    expect(await readSseEvents(response)).toEqual([
      { event: 'chunk', data: { text: 'parcial' } },
      {
        event: 'error',
        data: { error: { code: 'LLM_TIMEOUT', message: 'O serviço de IA demorou demais.' } },
      },
    ]);
  });

  it('hides unexpected error details inside the stream too', async () => {
    const llm = createFakeLlm({
      generateStream: async function* () {
        await Promise.resolve();
        yield 'parcial';
        throw new Error('segredo interno');
      },
    });
    const { baseUrl } = await start(llm);

    const response = await postJson(baseUrl, '/api/review/stream', { resumeText: VALID_RESUME });
    const text = await response.text();

    expect(text).toContain('INTERNAL_ERROR');
    expect(text).not.toContain('segredo interno');
  });

  it('aborts the model call when the client disconnects', async () => {
    let upstreamAborted: () => void = () => undefined;
    const aborted = new Promise<void>((resolve) => {
      upstreamAborted = resolve;
    });

    const llm = createFakeLlm({
      generateStream: async function* (params) {
        yield 'primeiro';

        await new Promise<void>((resolve) => {
          params.signal?.addEventListener('abort', () => {
            upstreamAborted();
            resolve();
          });
        });
      },
    });
    const { baseUrl } = await start(llm);

    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/review/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: VALID_RESUME }),
      signal: controller.signal,
    });

    const reader = response.body?.getReader();
    await reader?.read();
    controller.abort();

    await expect(
      Promise.race([
        aborted.then(() => 'aborted'),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 2000)),
      ]),
    ).resolves.toBe('aborted');
  });
});

describe('rate limit on /api/review', () => {
  it('answers 429 after the allowed number of requests in the window', async () => {
    const { baseUrl } = await start(createFakeLlm());

    for (let i = 0; i < LIMITS.reviewRateMaxRequests; i += 1) {
      const response = await postJson(baseUrl, '/api/review', {});
      expect(response.status).toBe(400);
    }

    const blocked = await postJson(baseUrl, '/api/review', {});
    const body = (await blocked.json()) as { error: { code: string } };

    expect(blocked.status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('does not limit the health check', async () => {
    const { baseUrl } = await start(createFakeLlm());

    for (let i = 0; i < LIMITS.reviewRateMaxRequests + 2; i += 1) {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);
    }
  });
});