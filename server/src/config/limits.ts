export const LIMITS = {
  // Tamanho máximo do corpo JSON. Com os limites de caracteres abaixo
  // (~23 mil caracteres), mesmo no pior caso de UTF-8 o corpo cabe em 100 KB.
  jsonBodyLimit: '100kb',
  resumeMinChars: 50,
  resumeMaxChars: 15_000,
  jobDescriptionMaxChars: 8_000,
  reviewRateWindowMs: 60_000,
  reviewRateMaxRequests: 10,
} as const;