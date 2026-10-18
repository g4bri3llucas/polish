import { describe, expect, it } from 'vitest';
import { LIMITS } from '../config/limits';
import { AppError } from '../errors/AppError';
import { parseReviewRequest } from './reviewRequest';

const resume = 'a'.repeat(LIMITS.resumeMinChars);

function catchError(body: unknown): AppError {
  try {
    parseReviewRequest(body);
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }
    throw error;
  }

  throw new Error('Era esperado um AppError, mas nada foi lançado.');
}

describe('parseReviewRequest', () => {
  it('accepts a resume without job description', () => {
    expect(parseReviewRequest({ resumeText: resume })).toEqual({
      resumeText: resume,
      jobDescription: undefined,
    });
  });

  it('trims spaces around both fields', () => {
    const result = parseReviewRequest({
      resumeText: `   ${resume}   `,
      jobDescription: '  Vaga de front-end  ',
    });

    expect(result.resumeText).toBe(resume);
    expect(result.jobDescription).toBe('Vaga de front-end');
  });

  it.each([['empty string', ''], ['only spaces', '   '], ['null', null]])(
    'treats a %s job description as absent',
    (_name, jobDescription) => {
      const result = parseReviewRequest({ resumeText: resume, jobDescription });

      expect(result.jobDescription).toBeUndefined();
    },
  );

  it('accepts a resume exactly at the minimum and maximum sizes', () => {
    expect(() => parseReviewRequest({ resumeText: 'a'.repeat(LIMITS.resumeMinChars) })).not.toThrow();
    expect(() => parseReviewRequest({ resumeText: 'a'.repeat(LIMITS.resumeMaxChars) })).not.toThrow();
  });

  it('rejects a resume that is too short, counting after trim', () => {
    const error = catchError({ resumeText: `   ${'a'.repeat(LIMITS.resumeMinChars - 1)}   ` });

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('INVALID_REQUEST');
    expect(error.details?.[0]?.field).toBe('resumeText');
  });

  it('rejects a resume that is too long', () => {
    const error = catchError({ resumeText: 'a'.repeat(LIMITS.resumeMaxChars + 1) });

    expect(error.details?.[0]?.field).toBe('resumeText');
  });

  it('rejects a job description that is too long', () => {
    const error = catchError({
      resumeText: resume,
      jobDescription: 'a'.repeat(LIMITS.jobDescriptionMaxChars + 1),
    });

    expect(error.details?.[0]?.field).toBe('jobDescription');
  });

  it('rejects a missing resumeText', () => {
    const error = catchError({});

    expect(error.details?.map((detail) => detail.field)).toContain('resumeText');
  });

  it('rejects fields with the wrong type', () => {
    expect(catchError({ resumeText: 123 }).details?.[0]?.field).toBe('resumeText');
    expect(
      catchError({ resumeText: resume, jobDescription: 42 }).details?.[0]?.field,
    ).toBe('jobDescription');
  });

  it.each([['null', null], ['a string', 'texto'], ['undefined', undefined]])(
    'rejects a body that is %s',
    (_name, body) => {
      expect(catchError(body).code).toBe('INVALID_REQUEST');
    },
  );
});