export const LIMITS = {
  jsonBodyLimit: '100kb',
  resumeMinChars: 50,
  resumeMaxChars: 15_000,
  jobDescriptionMaxChars: 8_000,
  reviewRateWindowMs: 60_000,
  reviewRateMaxRequests: 10,
} as const;