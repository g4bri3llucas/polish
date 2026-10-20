import { Observable } from 'rxjs';
import type { ReviewStreamEvent } from '../review.model';
import { ReviewApiError } from '../review-api';

const encoder = new TextEncoder();

// Cria uma resposta HTTP cujo corpo chega em pedaços, como no streaming real.
export function streamResponse(chunks: string[], init: ResponseInit = { status: 200 }): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(body, init);
}

export function sseChunk(text: string): string {
  return `event: chunk\ndata: ${JSON.stringify({ text })}\n\n`;
}

export const SSE_DONE = 'event: done\ndata: {}\n\n';

export interface Collected {
  events: ReviewStreamEvent[];
  error: ReviewApiError | null;
  completed: boolean;
}

export function collect(source: Observable<ReviewStreamEvent>): Promise<Collected> {
  return new Promise((resolve) => {
    const result: Collected = { events: [], error: null, completed: false };

    source.subscribe({
      next: (event) => result.events.push(event),
      error: (error: unknown) => {
        result.error = error as ReviewApiError;
        resolve(result);
      },
      complete: () => {
        result.completed = true;
        resolve(result);
      },
    });
  });
}