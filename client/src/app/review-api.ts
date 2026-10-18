import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import type { ReviewRequest, ReviewStreamEvent } from './review.model';
import { SseParser, type SseMessage } from './sse-parser';

export class ReviewApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ReviewApiError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

// Lê o formato de erro da nossa API: { error: { code, message } }.
function readApiError(body: unknown): ReviewApiError | null {
  if (!isRecord(body)) {
    return null;
  }

  const error = body['error'];

  if (!isRecord(error)) {
    return null;
  }

  const code = error['code'];
  const message = error['message'];

  if (typeof code !== 'string' || typeof message !== 'string') {
    return null;
  }

  return new ReviewApiError(code, message);
}

async function readErrorResponse(response: Response): Promise<ReviewApiError> {
  const body = parseJson(await response.text());

  return (
    readApiError(body) ??
    new ReviewApiError('HTTP_ERROR', `O servidor respondeu com erro ${response.status}.`)
  );
}

function toStreamEvent(message: SseMessage): ReviewStreamEvent | null {
  const payload = parseJson(message.data);

  if (message.event === 'chunk') {
    if (isRecord(payload) && typeof payload['text'] === 'string') {
      return { type: 'chunk', text: payload['text'] };
    }

    throw new ReviewApiError('INVALID_STREAM', 'O servidor enviou um trecho inválido.');
  }

  if (message.event === 'done') {
    return { type: 'done' };
  }

  if (message.event === 'error') {
    throw (
      readApiError(payload) ??
      new ReviewApiError('STREAM_ERROR', 'A revisão foi interrompida por um erro no servidor.')
    );
  }

  // Eventos que não conhecemos são ignorados.
  return null;
}

function toApiError(error: unknown): ReviewApiError {
  if (error instanceof ReviewApiError) {
    return error;
  }

  // Quando o fetch não consegue nem chegar ao servidor, ele lança um TypeError.
  if (error instanceof TypeError) {
    return new ReviewApiError(
      'NETWORK_ERROR',
      'Não consegui falar com o servidor. Confira se o back-end está rodando e tente de novo.',
    );
  }

  return new ReviewApiError('UNKNOWN_ERROR', 'Algo deu errado. Tente de novo.');
}

@Injectable({ providedIn: 'root' })
export class ReviewApi {
  private readonly baseUrl = inject(API_BASE_URL);

  // Cancelar a inscrição (unsubscribe) cancela a requisição.
  streamReview(request: ReviewRequest): Observable<ReviewStreamEvent> {
    return new Observable<ReviewStreamEvent>((subscriber) => {
      const controller = new AbortController();

      this.read(request, controller.signal, (event) => {
        subscriber.next(event);
      })
        .then(() => {
          subscriber.complete();
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            subscriber.error(toApiError(error));
          }
        });

      return () => {
        controller.abort();
      };
    });
  }

  private async read(
    request: ReviewRequest,
    signal: AbortSignal,
    emit: (event: ReviewStreamEvent) => void,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/review/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    if (response.body === null) {
      throw new ReviewApiError('EMPTY_RESPONSE', 'O servidor não enviou nenhum conteúdo.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let finished = false;

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      for (const message of parser.push(decoder.decode(value, { stream: true }))) {
        const event = toStreamEvent(message);

        if (event !== null) {
          finished = finished || event.type === 'done';
          emit(event);
        }
      }
    }

    if (!finished) {
      throw new ReviewApiError(
        'STREAM_INTERRUPTED',
        'A conexão foi interrompida antes do fim da revisão.',
      );
    }
  }
}