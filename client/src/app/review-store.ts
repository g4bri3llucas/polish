import { Injectable, computed, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { ReviewApi, ReviewApiError } from './review-api';
import { parseReview } from './review-format';
import type { ReviewRequest } from './review.model';

export type ReviewStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

@Injectable({ providedIn: 'root' })
export class ReviewStore {
  private readonly api = inject(ReviewApi);

  private subscription: Subscription | null = null;
  private lastRequest: ReviewRequest | null = null;

  private readonly statusState = signal<ReviewStatus>('idle');
  private readonly textState = signal('');
  private readonly errorState = signal<ReviewApiError | null>(null);
  private readonly restartedState = signal(false);

  readonly status = this.statusState.asReadonly();
  readonly text = this.textState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly restarted = this.restartedState.asReadonly();

  readonly busy = computed(
    () => this.statusState() === 'loading' || this.statusState() === 'streaming',
  );
  readonly review = computed(() => parseReview(this.textState()));

  submit(request: ReviewRequest): void {
    this.stop();
    this.lastRequest = request;
    this.textState.set('');
    this.errorState.set(null);
    this.restartedState.set(false);
    this.statusState.set('loading');

    this.subscription = this.api.streamReview(request).subscribe({
      next: (event) => {
        if (event.type === 'chunk') {
          this.textState.update((text) => text + event.text);
          this.statusState.set('streaming');
        }

        if (event.type === 'restart') {
          this.textState.set('');
          this.restartedState.set(true);
          this.statusState.set('loading');
        }
      },
      error: (error: unknown) => {
        this.errorState.set(
          error instanceof ReviewApiError
            ? error
            : new ReviewApiError('UNKNOWN_ERROR', 'Algo deu errado. Tente de novo.'),
        );
        this.statusState.set('error');
      },
      complete: () => {
        this.statusState.set('done');
      },
    });
  }

  retry(): void {
    if (this.lastRequest !== null) {
      this.submit(this.lastRequest);
    }
  }

  reset(): void {
    this.stop();
    this.lastRequest = null;
    this.textState.set('');
    this.errorState.set(null);
    this.restartedState.set(false);
    this.statusState.set('idle');
  }

  private stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }
}