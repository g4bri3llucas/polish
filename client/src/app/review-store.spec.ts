import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ReviewApi, ReviewApiError } from './review-api';
import type { ReviewRequest, ReviewStreamEvent } from './review.model';
import { ReviewStore } from './review-store';

const REQUEST: ReviewRequest = { resumeText: 'a'.repeat(60) };

describe('ReviewStore', () => {
  let store: ReviewStore;
  let streams: Subject<ReviewStreamEvent>[];
  let streamReview: ReturnType<typeof vi.fn>;
  let unsubscribed: boolean[];

  beforeEach(() => {
    streams = [];
    unsubscribed = [];
    streamReview = vi.fn(() => {
      const subject = new Subject<ReviewStreamEvent>();
      const index = streams.push(subject) - 1;
      unsubscribed[index] = false;

      return new (class {
        subscribe(observer: Parameters<Subject<ReviewStreamEvent>['subscribe']>[0]) {
          const inner = subject.subscribe(observer);
          return {
            unsubscribe: () => {
              unsubscribed[index] = true;
              inner.unsubscribe();
            },
          };
        }
      })();
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ReviewApi, useValue: { streamReview } }],
    });
    store = TestBed.inject(ReviewStore);
  });

  function current(): Subject<ReviewStreamEvent> {
    const subject = streams[streams.length - 1];
    if (subject === undefined) {
      throw new Error('No stream was opened.');
    }
    return subject;
  }

  it('starts idle and empty', () => {
    expect(store.status()).toBe('idle');
    expect(store.text()).toBe('');
    expect(store.error()).toBeNull();
    expect(store.busy()).toBe(false);
    expect(store.review()).toEqual({ score: null, blocks: [] });
  });

  it('goes to loading when a request is submitted', () => {
    store.submit(REQUEST);

    expect(streamReview).toHaveBeenCalledWith(REQUEST);
    expect(store.status()).toBe('loading');
    expect(store.busy()).toBe(true);
  });

  it('goes to streaming on the first chunk and accumulates the text', () => {
    store.submit(REQUEST);

    current().next({ type: 'chunk', text: '## Nota\n' });
    expect(store.status()).toBe('streaming');
    expect(store.busy()).toBe(true);

    current().next({ type: 'chunk', text: '**80/100** — Bom' });
    expect(store.text()).toBe('## Nota\n**80/100** — Bom');
    expect(store.review().score).toBe(80);
  });

  it('is done when the stream completes', () => {
    store.submit(REQUEST);
    current().next({ type: 'chunk', text: 'oi' });
    current().next({ type: 'done' });
    current().complete();

    expect(store.status()).toBe('done');
    expect(store.busy()).toBe(false);
    expect(store.text()).toBe('oi');
  });

  it('keeps the partial text and exposes the error when the stream fails', () => {
    store.submit(REQUEST);
    current().next({ type: 'chunk', text: 'parcial' });
    current().error(new ReviewApiError('LLM_TIMEOUT', 'Demorou demais.'));

    expect(store.status()).toBe('error');
    expect(store.text()).toBe('parcial');
    expect(store.error()?.code).toBe('LLM_TIMEOUT');
    expect(store.busy()).toBe(false);
  });

  it('wraps unexpected errors in a ReviewApiError', () => {
    store.submit(REQUEST);
    current().error(new Error('boom'));

    expect(store.status()).toBe('error');
    expect(store.error()).toBeInstanceOf(ReviewApiError);
    expect(store.error()?.code).toBe('UNKNOWN_ERROR');
  });

  it('retry sends the last request again and clears the previous error and text', () => {
    store.submit(REQUEST);
    current().next({ type: 'chunk', text: 'parcial' });
    current().error(new ReviewApiError('NETWORK_ERROR', 'Sem rede.'));

    store.retry();

    expect(streamReview).toHaveBeenCalledTimes(2);
    expect(streamReview).toHaveBeenLastCalledWith(REQUEST);
    expect(store.status()).toBe('loading');
    expect(store.text()).toBe('');
    expect(store.error()).toBeNull();
  });

  it('retry does nothing before the first submit', () => {
    store.retry();

    expect(streamReview).not.toHaveBeenCalled();
    expect(store.status()).toBe('idle');
  });

  it('cancels the previous request when a new one is submitted', () => {
    store.submit(REQUEST);
    store.submit({ resumeText: 'b'.repeat(60) });

    expect(unsubscribed[0]).toBe(true);
    expect(unsubscribed[1]).toBe(false);
  });

  it('ignores chunks from a request that was replaced', () => {
    store.submit(REQUEST);
    const first = current();
    store.submit({ resumeText: 'b'.repeat(60) });

    first.next({ type: 'chunk', text: 'velho' });

    expect(store.text()).toBe('');
  });

  it('reset cancels the request and returns to the initial state', () => {
    store.submit(REQUEST);
    current().next({ type: 'chunk', text: 'oi' });

    store.reset();

    expect(unsubscribed[0]).toBe(true);
    expect(store.status()).toBe('idle');
    expect(store.text()).toBe('');
    expect(store.error()).toBeNull();

    store.retry();
    expect(streamReview).toHaveBeenCalledTimes(1);
  });
});