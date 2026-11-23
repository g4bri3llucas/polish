import { Router, type Response } from 'express';
import { AppError } from '../errors/AppError';
import { reviewResume, reviewResumeStream } from '../services/reviewService';
import type { LlmClient } from '../services/llmClient';
import { openEventStream, writeEvent } from '../utils/sse';
import { parseReviewRequest } from '../validation/reviewRequest';


const MAX_RESTARTS = 2;

function isOverloaded(error: unknown): boolean {
  return error instanceof AppError && error.code === 'LLM_OVERLOADED';
}

function writeStreamError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    writeEvent(res, 'error', {
      error: { code: error.code, message: error.message },
    });
    return;
  }

  console.error(error);

  writeEvent(res, 'error', {
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
  });
}

export function createReviewRouter(llmClient: LlmClient): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const request = parseReviewRequest(req.body);
    const review = await reviewResume(request, llmClient);

    res.json({ review });
  });

  router.post('/stream', async (req, res) => {
    const request = parseReviewRequest(req.body);


    const abortController = new AbortController();
    res.on('close', () => {
      abortController.abort();
    });

    const startReview = (): AsyncIterator<string> =>
      reviewResumeStream(request, llmClient, abortController.signal)[
        Symbol.asyncIterator
      ]();

    let chunks = startReview();
    let restarts = 0;

    
    const nextChunk = async (): Promise<IteratorResult<string>> => {
      for (;;) {
        try {
          return await chunks.next();
        } catch (error) {
          if (
            abortController.signal.aborted ||
            !isOverloaded(error) ||
            restarts >= MAX_RESTARTS
          ) {
            throw error;
          }

          restarts++;
          writeEvent(res, 'restart', {});
          chunks = startReview();
        }
      }
    };

    
    let next: IteratorResult<string>;

    try {
      next = await chunks.next();
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      throw error;
    }

    openEventStream(res);

    try {
      while (next.done !== true) {
        writeEvent(res, 'chunk', { text: next.value });
        next = await nextChunk();
      }

      writeEvent(res, 'done', {});
    } catch (error) {
      if (!abortController.signal.aborted) {
        writeStreamError(res, error);
      }
    } finally {
      res.end();
    }
  });

  return router;
}