import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { LIMITS } from '../config/limits';

export function createReviewRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: LIMITS.reviewRateWindowMs,
    limit: LIMITS.reviewRateMaxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message:
            'Muitas requisições. Aguarde um instante e tente novamente.',
        },
      });
    },
  });
}