import { Router, type Response } from 'express';
import { AppError } from '../errors/AppError';
import { reviewResume, reviewResumeStream } from '../services/reviewService';
import type { LlmClient } from '../services/llmClient';
import { openEventStream, writeEvent } from '../utils/sse';
import { parseReviewRequest } from '../validation/reviewRequest';

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

    // Se o navegador fechar a conexão, cancela a chamada ao LLM para
    // não continuar gastando cota à toa.
    const abortController = new AbortController();
    res.on('close', () => {
      abortController.abort();
    });

    const chunks = reviewResumeStream(
      request,
      llmClient,
      abortController.signal,
    )[Symbol.asyncIterator]();

    // Pede o primeiro pedaço ANTES de abrir o stream. Se o provedor falhar
    // logo de cara (chave inválida, cota esgotada...), ainda não enviei
    // nenhum cabeçalho e o errorHandler responde com o status HTTP correto.
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
        next = await chunks.next();
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