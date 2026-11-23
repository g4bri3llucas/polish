import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { InlineSegment } from './review-format';

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