import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ReviewRequest } from '../review.model';
import { ReviewForm } from './review-form';

const VALID_RESUME = 'Joao Silva. Desenvolvedor front-end. '.repeat(3);

describe('ReviewForm', () => {
  let fixture: ComponentFixture<ReviewForm>;
  let root: HTMLElement;
  let submitted: ReviewRequest[];
  let cleared: number;
  let cancelled: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReviewForm] }).compileComponents();
    fixture = TestBed.createComponent(ReviewForm);
    root = fixture.nativeElement as HTMLElement;
    submitted = [];
    cleared = 0;
    cancelled = 0;
    fixture.componentInstance.submitted.subscribe((request) => submitted.push(request));
    fixture.componentInstance.cleared.subscribe(() => cleared++);
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    await fixture.whenStable();
  });

  function field(id: string): HTMLTextAreaElement {
    const element = root.querySelector<HTMLTextAreaElement>(`#${id}`);
    if (element === null) {
      throw new Error(`Field #${id} not found.`);
    }
    return element;
  }

  async function type(id: string, value: string): Promise<void> {
    const element = field(id);
    element.value = value;
    element.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function blur(id: string): Promise<void> {
    field(id).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  function errorText(id: string): string | null {
    return root.querySelector(`#${id}-error`)?.textContent?.trim() ?? null;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll('button')).find((item) =>
      item.textContent.includes(label),
    );
  }

  it('shows no error before the user interacts', () => {
    expect(errorText('resumeText')).toBeNull();
    expect(root.querySelector('#resumeText-count')?.textContent).toContain('0 / 15.000');
  });

  it('asks for the resume when the empty field loses focus', async () => {
    await blur('resumeText');

    expect(errorText('resumeText')).toBe('Cole o texto do seu currículo para começar.');
    expect(field('resumeText').getAttribute('aria-invalid')).toBe('true');
  });

  it('says how many characters are missing when the text is too short', async () => {
    await type('resumeText', 'a'.repeat(20));
    await blur('resumeText');

    expect(errorText('resumeText')).toBe('Escreva pelo menos 50 caracteres (faltam 30).');
  });

  it('says how many characters to remove when the text is too long', async () => {
    await type('resumeText', 'a'.repeat(15_010));
    await blur('resumeText');

    expect(errorText('resumeText')).toBe('Remova 10 caracteres: o limite é 15.000.');
    expect(root.querySelector('#resumeText-count')?.classList.contains('over')).toBe(true);
  });

  it('validates the optional job description limit', async () => {
    await type('jobDescription', 'a'.repeat(8_001));
    await blur('jobDescription');

    expect(errorText('jobDescription')).toBe('Remova 1 caracteres: o limite é 8.000.');
  });

  it('does not emit and focuses the first invalid field when submitting an invalid form', async () => {
    document.body.appendChild(root);

    await submit();

    expect(submitted).toEqual([]);
    expect(errorText('resumeText')).not.toBeNull();
    expect(document.activeElement).toBe(field('resumeText'));

    root.remove();
  });

  it('emits the trimmed resume without jobDescription when it is empty', async () => {
    await type('resumeText', `  ${VALID_RESUME}  `);
    await type('jobDescription', '   ');

    await submit();

    expect(submitted).toEqual([{ resumeText: VALID_RESUME.trim() }]);
  });

  it('emits the trimmed job description when provided', async () => {
    await type('resumeText', VALID_RESUME);
    await type('jobDescription', '  Vaga de Angular  ');

    await submit();

    expect(submitted).toEqual([
      { resumeText: VALID_RESUME.trim(), jobDescription: 'Vaga de Angular' },
    ]);
  });

  it('does not emit while busy', async () => {
    fixture.componentRef.setInput('busy', true);
    await type('resumeText', VALID_RESUME);

    await submit();

    expect(submitted).toEqual([]);
  });

  it('shows "Cancelar" instead of "Limpar" while busy, and emits cancelled', async () => {
    expect(button('Limpar')).toBeDefined();
    expect(button('Cancelar')).toBeUndefined();

    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect(button('Limpar')).toBeUndefined();
    expect(button('Revisando')).toBeDefined();
    button('Cancelar')?.click();
    expect(cancelled).toBe(1);
  });

  it('clears the fields and emits cleared', async () => {
    await type('resumeText', VALID_RESUME);
    await type('jobDescription', 'Vaga');

    button('Limpar')?.click();
    await fixture.whenStable();

    expect(field('resumeText').value).toBe('');
    expect(field('jobDescription').value).toBe('');
    expect(errorText('resumeText')).toBeNull();
    expect(cleared).toBe(1);
  });
});