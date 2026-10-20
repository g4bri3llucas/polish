import { FormControl } from '@angular/forms';
import { minTrimmedLength, requiredTrimmed } from './validators';

describe('requiredTrimmed', () => {
  it('rejects empty and whitespace-only values', () => {
    expect(requiredTrimmed(new FormControl(''))).toEqual({ requiredTrimmed: true });
    expect(requiredTrimmed(new FormControl('   \n\t '))).toEqual({ requiredTrimmed: true });
  });

  it('rejects values that are not text', () => {
    expect(requiredTrimmed(new FormControl(null))).toEqual({ requiredTrimmed: true });
  });

  it('accepts text with content', () => {
    expect(requiredTrimmed(new FormControl('  oi  '))).toBeNull();
  });
});

describe('minTrimmedLength', () => {
  const validator = minTrimmedLength(5);

  it('counts the length after trimming', () => {
    expect(validator(new FormControl('   abc   '))).toEqual({
      minTrimmedLength: { min: 5, actual: 3 },
    });
  });

  it('accepts exactly the minimum', () => {
    expect(validator(new FormControl(' abcde '))).toBeNull();
  });

  it('leaves empty values to requiredTrimmed', () => {
    expect(validator(new FormControl(''))).toBeNull();
    expect(validator(new FormControl('   '))).toBeNull();
  });
});