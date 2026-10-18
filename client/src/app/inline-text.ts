import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { InlineSegment } from './review-format';

// Usado como atributo em um <p> ou <li>: <p appInlineText [segments]="...">.
@Component({
  selector: '[appInlineText]',
  template: `@for (segment of segments(); track $index) {
    @if (segment.bold) {
      <strong>{{ segment.text }}</strong>
    } @else {
      <span>{{ segment.text }}</span>
    }
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineText {
  readonly segments = input.required<InlineSegment[]>();
}