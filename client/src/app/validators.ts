import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

function trimmedLength(control: AbstractControl): number {
  const value: unknown = control.value;
  return typeof value === 'string' ? value.trim().length : 0;
}


export function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  return trimmedLength(control) === 0 ? { requiredTrimmed: true } : null;
}

export function minTrimmedLength(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = trimmedLength(control);

    // Texto vazio já é tratado por requiredTrimmed.
    if (length === 0 || length >= min) {
      return null;
    }

    return { minTrimmedLength: { min, actual: length } };
  };
}