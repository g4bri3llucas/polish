import { Subject } from 'rxjs';
import type { ReviewStreamEvent } from '../review.model';

// ReviewApi falso: em vez de chamar a rede, o teste decide o que "chega".
export class FakeReviewApi {
  readonly streams: Subject<ReviewStreamEvent>[] = [];

  streamReview = vi.fn(() => {
    const subject = new Subject<ReviewStreamEvent>();
    this.streams.push(subject);
    return subject.asObservable();
  });

  get latest(): Subject<ReviewStreamEvent> {
    const subject = this.streams[this.streams.length - 1];
    if (subject === undefined) {
      throw new Error('No stream was opened.');
    }
    return subject;
  }
}