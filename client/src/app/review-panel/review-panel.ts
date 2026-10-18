import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { InlineText } from '../inline-text';
import { ReviewStore } from '../review-store';

@Component({
  selector: 'app-review-panel',
  imports: [InlineText],
  templateUrl: './review-panel.html',
  styleUrl: './review-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPanel {
  protected readonly store = inject(ReviewStore);

  protected readonly title = computed(() => {
    switch (this.store.status()) {
      case 'loading':
        return 'Lendo seu currículo';
      case 'streaming':
        return 'Escrevendo sua revisão';
      case 'done':
        return 'Sua revisão';
      case 'error':
        return this.store.text() === ''
          ? 'Não foi possível concluir a revisão'
          : 'Revisão interrompida';
      default:
        return 'Sua revisão aparece aqui';
    }
  });

  // Anunciar cada pedaço de texto seria barulhento para quem usa leitor de
  // tela, então avisamos apenas quando algo importante muda.
  protected readonly announcement = computed(() => {
    switch (this.store.status()) {
      case 'loading':
        return 'Enviando seu currículo.';
      case 'done':
        return 'A revisão ficou pronta.';
      default:
        return '';
    }
  });

  protected retry(): void {
    this.store.retry();
  }
}