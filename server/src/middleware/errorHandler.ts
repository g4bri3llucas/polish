import type { NextFunction, Request, Response } from 'express';
import { LIMITS } from '../config/limits';
import { AppError } from '../errors/AppError';

function hasStringType(err: unknown): err is { type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof err.type === 'string'
  );
}

// O express.json() lança erros próprios (JSON quebrado, corpo grande demais).
// Aqui eles viram AppError, para saírem no mesmo formato dos demais.
function fromBodyParserError(err: unknown): AppError | undefined {
  if (!hasStringType(err)) {
    return undefined;
  }

  if (err.type === 'entity.parse.failed') {
    return new AppError(
      400,
      'INVALID_JSON',
      'O corpo da requisição não é um JSON válido.',
    );
  }

  if (err.type === 'entity.too.large') {
    return new AppError(
      413,
      'PAYLOAD_TOO_LARGE',
      `O corpo da requisição excede o tamanho máximo de ${LIMITS.jsonBodyLimit}.`,
    );
  }

  return undefined;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Rota não encontrada.',
    },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError = err instanceof AppError ? err : fromBodyParserError(err);

  if (appError === undefined) {
    console.error(err);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor.',
      },
    });
    return;
  }

  if (appError.statusCode >= 500) {
    console.error(appError);
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined && { details: appError.details }),
    },
  });
}