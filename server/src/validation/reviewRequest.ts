import { z } from 'zod';
import { LIMITS } from '../config/limits';
import { AppError } from '../errors/AppError';

const formatNumber = (value: number): string => value.toLocaleString('pt-BR');

const reviewRequestSchema = z.object(
  {
    resumeText: z
      .string({
        error: 'O campo "resumeText" é obrigatório e deve ser um texto.',
      })
      .trim()
      .min(LIMITS.resumeMinChars, {
        error: `O campo "resumeText" deve ter pelo menos ${formatNumber(LIMITS.resumeMinChars)} caracteres.`,
      })
      .max(LIMITS.resumeMaxChars, {
        error: `O campo "resumeText" deve ter no máximo ${formatNumber(LIMITS.resumeMaxChars)} caracteres.`,
      }),
    jobDescription: z
      .string({
        error: 'O campo "jobDescription", quando enviado, deve ser um texto.',
      })
      .trim()
      .max(LIMITS.jobDescriptionMaxChars, {
        error: `O campo "jobDescription" deve ter no máximo ${formatNumber(LIMITS.jobDescriptionMaxChars)} caracteres.`,
      })
      .nullish()
      .transform((value) =>
        value === undefined || value === null || value === ''
          ? undefined
          : value,
      ),
  },
  { error: 'O corpo da requisição deve ser um objeto JSON.' },
);

export type ReviewRequest = z.output<typeof reviewRequestSchema>;

export function parseReviewRequest(body: unknown): ReviewRequest {
  const result = reviewRequestSchema.safeParse(body);

  if (!result.success) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Os dados enviados são inválidos.',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  return result.data;
}