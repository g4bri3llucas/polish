import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import { ReviewApi, ReviewApiError } from './review-api';
import { SSE_DONE, collect, sseChunk, streamResponse } from './testing/sse-helpers';

const REQUEST = { resumeText: 'a'.repeat(60) };

describe('ReviewApi', () => {
  let api: ReviewApi;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      providers: [{ provide: API_BASE_URL, useValue: 'http://api.test' }],
    });
    api = TestBed.inject(ReviewApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a POST with the JSON body to the stream endpoint', async () => {
    fetchMock.mockResolvedValue(streamResponse([SSE_DONE]));

    await collect(api.streamReview({ ...REQUEST, jobDescription: 'Vaga' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/review/stream');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ ...REQUEST, jobDescription: 'Vaga' });
  });

  it('emits chunks in order and completes after "done"', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([sseChunk('## Nota\n'), sseChunk('**80/100**'), SSE_DONE]),
    );

    const result = await collect(api.streamReview(REQUEST));

    expect(result.events).toEqual([
      { type: 'chunk', text: '## Nota\n' },
      { type: 'chunk', text: '**80/100**' },
      { type: 'done' },
    ]);
    expect(result.completed).toBe(true);
    expect(result.error).toBeNull();
  });

  it('reassembles messages and multi-byte characters split across network chunks', async () => {
    const full = sseChunk('Avaliação ✓') + SSE_DONE;
    const bytes = new TextEncoder().encode(full);
    // Corta no meio de um caractere de vários bytos ("ç" ou "✓").
    const cut = bytes.indexOf(0xe2) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }));

    const result = await collect(api.streamReview(REQUEST));

    expect(result.events[0]).toEqual({ type: 'chunk', text: 'Avaliação ✓' });
  });

  it('ignores events it does not know', async () => {
    fetchMock.mockResolvedValue(
      streamResponse(['event: ping\ndata: {}\n\n', sseChunk('oi'), SSE_DONE]),
    );

    const result = await collect(api.streamReview(REQUEST));

    expect(result.events).toEqual([{ type: 'chunk', text: 'oi' }, { type: 'done' }]);
  });

  it('turns an HTTP error with our JSON format into a ReviewApiError', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Dados inválidos.' } }),
        { status: 400 },
      ),
    );

    const result = await collect(api.streamReview(REQUEST));

    expect(result.error).toBeInstanceOf(ReviewApiError);
    expect(result.error?.code).toBe('INVALID_REQUEST');
    expect(result.error?.message).toBe('Dados inválidos.');
    expect(result.completed).toBe(false);
  });

  it('uses a generic HTTP_ERROR when the error body is not our format', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const result = await collect(api.streamReview(REQUEST));

    expect(result.error?.code).toBe('HTTP_ERROR');
    expect(result.error?.message).toContain('502');
  });

  it('reports a NETWORK_ERROR when fetch cannot reach the server', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await collect(api.streamReview(REQUEST));

    expect(result.error?.code).toBe('NETWORK_ERROR');
  });

  it('reports an EMPTY_RESPONSE when the response has no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await collect(api.streamReview(REQUEST));

    expect(result.error?.code).toBe('EMPTY_RESPONSE');
  });

  it('forwards an "error" event sent by the server mid-stream', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        sseChunk('Parte da revisão'),
        `event: error\ndata: ${JSON.stringify({ error: { code: 'LLM_TIMEOUT', message: 'Demorou demais.' } })}\n\n`,
      ]),
    );

    const result = await collect(api.streamReview(REQUEST));

    expect(result.events).toEqual([{ type: 'chunk', text: 'Parte da revisão' }]);
    expect(result.error?.code).toBe('LLM_TIMEOUT');
    expect(result.error?.message).toBe('Demorou demais.');
  });

  it('uses STREAM_ERROR when the "error" event has no readable payload', async () => {
    fetchMock.mockResolvedValue(streamResponse(['event: error\ndata: nao-e-json\n\n']));

    const result = await collect(api.streamReview(REQUEST));

    expect(result.error?.code).toBe('STREAM_ERROR');
  });

  it('rejects a chunk event with an invalid payload', async () => {
    fetchMock.mockResolvedValue(streamResponse(['event: chunk\ndata: {"texto":1}\n\n']));

    const result = await collect(api.streamReview(REQUEST));

    expect(result.error?.code).toBe('INVALID_STREAM');
  });

  it('reports STREAM_INTERRUPTED when the connection ends without "done"', async () => {
    fetchMock.mockResolvedValue(streamResponse([sseChunk('metade')]));

    const result = await collect(api.streamReview(REQUEST));

    expect(result.events).toEqual([{ type: 'chunk', text: 'metade' }]);
    expect(result.error?.code).toBe('STREAM_INTERRUPTED');
  });

  it('aborts the request when the subscriber unsubscribes', async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    });
    const errors: unknown[] = [];

    const subscription = api.streamReview(REQUEST).subscribe({
      error: (error: unknown) => errors.push(error),
    });
    expect(signal?.aborted).toBe(false);

    subscription.unsubscribe();

    expect(signal?.aborted).toBe(true);
    expect(errors).toEqual([]);
  });

  it('does not report an error after being cancelled', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const next = vi.fn();
    const error = vi.fn();

    const subscription = api.streamReview(REQUEST).subscribe({ next, error });
    subscription.unsubscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});