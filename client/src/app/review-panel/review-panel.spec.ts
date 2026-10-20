import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReviewApi, ReviewApiError } from '../review-api';
import { ReviewStore } from '../review-store';
import { FakeReviewApi } from '../testing/fake-review-api';
import { ReviewPanel } from './review-panel';

describe('ReviewPanel', () => {
  let fixture: ComponentFixture<ReviewPanel>;
  let root: HTMLElement;
  let api: FakeReviewApi;
  let store: ReviewStore;

  beforeEach(async () => {
    api = new FakeReviewApi();
    await TestBed.configureTestingModule({
      imports: [ReviewPanel],
      providers: [{ provide: ReviewApi, useValue: api }],
    }).compileComponents();
    store = TestBed.inject(ReviewStore);
    fixture = TestBed.createComponent(ReviewPanel);
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const request = { resumeText: 'a'.repeat(60) };

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  function text(selector: string): string {
    return root.querySelector(selector)?.textContent?.trim() ?? '';
  }

  it('explains what to expect while idle', () => {
    expect(text('h2')).toBe('Sua revisão aparece aqui');
    expect(root.querySelectorAll('dt')).toHaveLength(4);
    expect(text('.grade-value')).toBe('?');
  });

  it('shows the loading state', async () => {
    store.submit(request);
    await settle();

    expect(text('h2')).toBe('Lendo seu currículo');
    expect(text('.grade-value')).toBe('…');
    expect(root.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    expect(text('[role="status"]')).toBe('Enviando seu currículo.');
  });

  it('renders the review as it streams, with the score, headings, lists and bold text', async () => {
    store.submit(request);
    api.latest.next({
      type: 'chunk',
      text: '## Nota\n**35/100** — Resumo curto.\n\n## Problemas\n- **Formato:** falta estrutura.\n',
    });
    await settle();

    expect(text('h2')).toBe('Escrevendo sua revisão');
    expect(text('.grade-value')).toBe('35');
    expect(Array.from(root.querySelectorAll('h3')).map((h) => h.textContent)).toEqual([
      'Nota',
      'Problemas',
    ]);
    expect(text('li strong')).toBe('Formato:');
    expect(root.querySelector('.review-text')?.classList.contains('writing')).toBe(true);
  });

  it('does not interpret HTML from the model', async () => {
    store.submit(request);
    api.latest.next({ type: 'chunk', text: '<img src=x onerror=alert(1)>' });
    await settle();

    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.review-text')?.textContent).toContain('<img src=x');
  });

  it('announces completion when done', async () => {
    store.submit(request);
    api.latest.next({ type: 'chunk', text: '## Nota\n**90/100** — ótimo' });
    api.latest.next({ type: 'done' });
    api.latest.complete();
    await settle();

    expect(text('h2')).toBe('Sua revisão');
    expect(text('[role="status"]')).toBe('A revisão ficou pronta.');
    expect(root.querySelector('.review-text')?.classList.contains('writing')).toBe(false);
    expect(root.querySelector('.failure')).toBeNull();
  });

  it('shows the failure and a retry button when nothing was received', async () => {
    store.submit(request);
    api.latest.error(new ReviewApiError('NETWORK_ERROR', 'Sem conexão.'));
    await settle();

    expect(text('h2')).toBe('Não foi possível concluir a revisão');
    expect(text('.failure p')).toBe('Sem conexão.');
    expect(root.querySelector('.failure')?.getAttribute('role')).toBe('alert');
  });

  it('keeps the partial text visible when the stream is interrupted', async () => {
    store.submit(request);
    api.latest.next({ type: 'chunk', text: '## Nota\nTexto parcial' });
    api.latest.error(new ReviewApiError('STREAM_INTERRUPTED', 'Conexão caiu.'));
    await settle();

    expect(text('h2')).toBe('Revisão interrompida');
    expect(text('.review-text')).toContain('Texto parcial');
    expect(text('.failure p')).toBe('Conexão caiu.');
  });

  it('retries the last request when "Tentar de novo" is clicked', async () => {
    store.submit(request);
    api.latest.error(new ReviewApiError('NETWORK_ERROR', 'Sem conexão.'));
    await settle();

    root.querySelector<HTMLButtonElement>('.retry')?.click();
    await settle();

    expect(api.streamReview).toHaveBeenCalledTimes(2);
    expect(api.streamReview).toHaveBeenLastCalledWith(request);
    expect(text('h2')).toBe('Lendo seu currículo');
  });
});