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
        return this.store.restarted() ? 'Recomeçando a revisão' : 'Lendo seu currículo';
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


  protected readonly announcement = computed(() => {
    switch (this.store.status()) {
      case 'loading':
        return this.store.restarted()
          ? 'O serviço de IA oscilou. A revisão está recomeçando.'
          : 'Enviando seu currículo.';
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