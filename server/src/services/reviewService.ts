import {
  REVIEW_SYSTEM_INSTRUCTION,
  buildReviewPrompt,
} from '../prompts/reviewPrompt';
import type { ReviewRequest } from '../validation/reviewRequest';
import type { LlmClient, LlmGenerateParams } from './llmClient';

function buildParams(
  request: ReviewRequest,
  signal?: AbortSignal,
): LlmGenerateParams {
  return {
    systemInstruction: REVIEW_SYSTEM_INSTRUCTION,
    prompt: buildReviewPrompt(request),
    ...(signal !== undefined && { signal }),
  };
}

export async function reviewResume(
  request: ReviewRequest,
  llmClient: LlmClient,
): Promise<string> {
  return llmClient.generate(buildParams(request));
}

export function reviewResumeStream(
  request: ReviewRequest,
  llmClient: LlmClient,
  signal: AbortSignal,
): AsyncIterable<string> {
  return llmClient.generateStream(buildParams(request, signal));
}