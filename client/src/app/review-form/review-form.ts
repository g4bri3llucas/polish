import { ChangeDetectionStrategy, Component, ElementRef, inject, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { REVIEW_LIMITS, type ReviewRequest } from '../review.model';
import { minTrimmedLength, requiredTrimmed } from '../validators';

type FieldName = 'resumeText' | 'jobDescription';

interface MinLengthError {
  min: number;
  actual: number;
}

interface MaxLengthError {
  requiredLength: number;
  actualLength: number;
}

const FIELD_ORDER: readonly FieldName[] = ['resumeText', 'jobDescription'];

@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule],
  templateUrl: './review-form.html',
  styleUrl: './review-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewForm {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly submitted = output<ReviewRequest>();
  readonly cleared = output<void>();

  protected readonly limits = REVIEW_LIMITS;

  protected readonly form = new FormGroup({
    resumeText: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        minTrimmedLength(REVIEW_LIMITS.resumeMinChars),
        Validators.maxLength(REVIEW_LIMITS.resumeMaxChars),
      ],
    }),
    jobDescription: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(REVIEW_LIMITS.jobDescriptionMaxChars)],
    }),
  });

  protected format(value: number): string {
    return value.toLocaleString('pt-BR');
  }

  protected lengthOf(name: FieldName): number {
    return this.form.controls[name].value.length;
  }

  protected isOverLimit(name: FieldName): boolean {
    return this.form.controls[name].hasError('maxlength');
  }

  protected errorMessage(name: FieldName): string | null {
    const control = this.form.controls[name];

    if (!control.touched || control.valid) {
      return null;
    }

    if (control.hasError('requiredTrimmed')) {
      return 'Cole o texto do seu currículo para começar.';
    }

    if (control.hasError('minTrimmedLength')) {
      const { min, actual } = control.getError('minTrimmedLength') as MinLengthError;
      return `Escreva pelo menos ${this.format(min)} caracteres (faltam ${this.format(min - actual)}).`;
    }

    if (control.hasError('maxlength')) {
      const { requiredLength, actualLength } = control.getError('maxlength') as MaxLengthError;
      return `Remova ${this.format(actualLength - requiredLength)} caracteres: o limite é ${this.format(requiredLength)}.`;
    }

    return null;
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }

    const { resumeText, jobDescription } = this.form.getRawValue();
    const job = jobDescription.trim();

    this.submitted.emit(
      job === ''
        ? { resumeText: resumeText.trim() }
        : { resumeText: resumeText.trim(), jobDescription: job },
    );
  }

  protected onClear(): void {
    this.form.reset();
    this.cleared.emit();
  }

  private focusFirstInvalid(): void {
    const first = FIELD_ORDER.find((name) => this.form.controls[name].invalid);

    if (first !== undefined) {
      this.host.nativeElement.querySelector<HTMLTextAreaElement>(`#${first}`)?.focus();
    }
  }
}