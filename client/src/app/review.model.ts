export interface ReviewRequest {
  resumeText: string;
  jobDescription?: string;
}

export type ReviewStreamEvent =
  { type: 'chunk'; text: string } | { type: 'restart' } | { type: 'done' };


export const REVIEW_LIMITS = {
  resumeMinChars: 50,
  resumeMaxChars: 15_000,
  jobDescriptionMaxChars: 8_000,
} as const;