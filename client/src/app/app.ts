import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ReviewForm } from './review-form/review-form';
import { ReviewPanel } from './review-panel/review-panel';
import type { ReviewRequest } from './review.model';

@Component({
  selector: 'app-root',
  imports: [ReviewForm, ReviewPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly request = signal<ReviewRequest | null>(null);

  protected onSubmitted(request: ReviewRequest): void {
    this.request.set(request);
  }

  protected onCleared(): void {
    this.request.set(null);
  }
}