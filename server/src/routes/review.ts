import { Router } from 'express';
import { reviewResume } from '../services/reviewService';
import type { LlmClient } from '../services/llmClient';
import { parseReviewRequest } from '../validation/reviewRequest';

export function createReviewRouter(llmClient: LlmClient): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const request = parseReviewRequest(req.body);
    const review = await reviewResume(request, llmClient);

    res.json({ review });
  });

  return router;
}