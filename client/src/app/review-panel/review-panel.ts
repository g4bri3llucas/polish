import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ReviewRequest } from '../review.model';

@Component({
  selector: 'app-review-panel',
  templateUrl: './review-panel.html',
  styleUrl: './review-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPanel {
  // Pedido enviado pelo formulário. 
  readonly request = input<ReviewRequest | null>(null);
}