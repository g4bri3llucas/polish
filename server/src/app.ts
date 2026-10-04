import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env';
import { LIMITS } from './config/limits';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createReviewRateLimiter } from './middleware/rateLimit';
import { healthRouter } from './routes/health';
import { createReviewRouter } from './routes/review';
import type { LlmClient } from './services/llmClient';

export interface AppDependencies {
  llmClient: LlmClient;
}

export function createApp({ llmClient }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.clientOrigin }));

  // O limite de requisições vem antes do parser de JSON, para barrar o abuso
  // antes de gastar processamento lendo o corpo.
  app.use('/api/review', createReviewRateLimiter());
  app.use(express.json({ limit: LIMITS.jsonBodyLimit }));

  app.use('/api/health', healthRouter);
  app.use('/api/review', createReviewRouter(llmClient));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}