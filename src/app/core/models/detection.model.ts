import { BBox } from './bbox.model';

export type Verdict = 'match' | 'no_match';
export type ValidationStatus = 'pending' | 'validated' | 'review' | 'dismissed';

export interface Match {
  catalogId: string;
  band: string;
  similarity: number;
  referenceImageUrl: string | null;
}

export interface Detection {
  id: string;
  /** Imagen del análisis en la que aparece esta detección. */
  imageId: string;
  bbox: BBox;
  confidence: number;
  verdict: Verdict;
  matches: Match[];
  validationStatus: ValidationStatus;
  validationNotes: string | null;
}
