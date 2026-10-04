import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
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
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/review', createReviewRouter(llmClient));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}