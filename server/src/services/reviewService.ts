import {
  REVIEW_SYSTEM_INSTRUCTION,
  buildReviewPrompt,
} from '../prompts/reviewPrompt';
import type { ReviewRequest } from '../validation/reviewRequest';
import type { LlmClient } from './llmClient';

export async function reviewResume(
  request: ReviewRequest,
  llmClient: LlmClient,
): Promise<string> {
  return llmClient.generate({
    systemInstruction: REVIEW_SYSTEM_INSTRUCTION,
    prompt: buildReviewPrompt(request),
  });
}