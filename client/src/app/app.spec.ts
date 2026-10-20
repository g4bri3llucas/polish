import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { ReviewApi } from './review-api';
import { FakeReviewApi } from './testing/fake-review-api';

const VALID_RESUME = 'Joao Silva. Desenvolvedor front-end. '.repeat(3);

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let root: HTMLElement;
  let api: FakeReviewApi;

  beforeEach(async () => {

    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('min-width'), media: query })),
    );
    api = new FakeReviewApi();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: ReviewApi, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function typeResume(value: string): Promise<void> {
    const textarea = root.querySelector<HTMLTextAreaElement>('#resumeText');
    if (textarea === null) {
      throw new Error('Resume field not found.');
    }
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the brand heading', () => {
    expect(root.querySelector('h1')?.textContent).toContain('Polish');
  });

  it('does not call the API when the form is invalid', async () => {
    await submit();

    expect(api.streamReview).not.toHaveBeenCalled();
  });

  it('goes from the form to a streamed review', async () => {
    await typeResume(VALID_RESUME);
    await submit();

    expect(api.streamReview).toHaveBeenCalledWith({ resumeText: VALID_RESUME.trim() });
    expect(root.querySelector('h2')?.textContent).toBe('Lendo seu currículo');

    api.latest.next({ type: 'chunk', text: '## Nota\n**70/100** — Bom começo.' });
    await fixture.whenStable();

    expect(root.querySelector('.grade-value')?.textContent?.trim()).toBe('70');
  });

  it('cancels the review and returns the panel to idle', async () => {
    await typeResume(VALID_RESUME);
    await submit();

    const cancel = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent.includes('Cancelar'),
    );
    cancel?.click();
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent).toBe('Sua revisão aparece aqui');
  });
});