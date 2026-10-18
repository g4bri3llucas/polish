import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ReviewForm } from './review-form/review-form';
import { ReviewPanel } from './review-panel/review-panel';
import type { ReviewRequest } from './review.model';
import { ReviewStore } from './review-store';

@Component({
  selector: 'app-root',
  imports: [ReviewForm, ReviewPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(ReviewStore);

  private readonly panel = viewChild.required(ReviewPanel, { read: ElementRef<HTMLElement> });

  constructor() {
    effect(() => {
      if (this.store.status() === 'loading') {
        this.revealPanel();
      }
    });
  }

  protected onSubmitted(request: ReviewRequest): void {
    this.store.submit(request);
  }

 
  protected onReset(): void {
    this.store.reset();
  }


  private revealPanel(): void {
    if (window.matchMedia('(min-width: 56rem)').matches) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.panel().nativeElement.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}