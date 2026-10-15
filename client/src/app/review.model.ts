export interface ReviewRequest {
  resumeText: string;
  jobDescription?: string;
}

// Espelham server/src/config/limits.ts. Se mudar lá, tenho que mudar aqui também.
// Quem decide de verdade é o servidor; estes valores só avisam antes de enviar.
export const REVIEW_LIMITS = {
  resumeMinChars: 50,
  resumeMaxChars: 15_000,
  jobDescriptionMaxChars: 8_000,
} as const;