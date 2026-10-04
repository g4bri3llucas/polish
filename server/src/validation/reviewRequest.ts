import { AppError } from '../errors/AppError';

export interface ReviewRequest {
  resumeText: string;
  jobDescription?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseReviewRequest(body: unknown): ReviewRequest {
  if (!isRecord(body)) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'O corpo da requisição deve ser um objeto JSON.',
    );
  }

  const resumeText = body['resumeText'];

  if (typeof resumeText !== 'string' || resumeText.trim() === '') {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'O campo "resumeText" é obrigatório e deve ser um texto não vazio.',
    );
  }

  const jobDescription = body['jobDescription'];

  if (jobDescription === undefined || jobDescription === null) {
    return { resumeText: resumeText.trim() };
  }

  if (typeof jobDescription !== 'string') {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'O campo "jobDescription", quando enviado, deve ser um texto.',
    );
  }

  const trimmedJob = jobDescription.trim();

  if (trimmedJob === '') {
    return { resumeText: resumeText.trim() };
  }

  return { resumeText: resumeText.trim(), jobDescription: trimmedJob };
}