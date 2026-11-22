/** Detección enviada a segunda revisión, tal como la lista un supervisor. */
export interface ReviewItem {
  analysisId: string;
  detectionId: string;
  thumbnailUrl: string | null;
  confidence: number;
  verdict: 'match' | 'no_match';
  topBand: string | null;
  topSimilarity: number | null;
  notes: string | null;
  requestedBy: string;
  requestedAt: string | null;
  personName: string | null;
  documentId: string | null;
}
