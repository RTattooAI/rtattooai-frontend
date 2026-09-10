import { BBox } from './bbox.model';

/**
 * `review` es la franja intermedia: hay un candidato razonable pero por debajo del
 * umbral firme. El sistema no lo afirma, lo pone delante de una persona.
 */
export type Verdict = 'match' | 'review' | 'no_match';

/**
 * Qué clase de coincidencia es, que no es lo mismo que si la hay:
 *
 * - `band`: coincide con una entrada atribuida a una banda.
 * - `unclassified`: coincide con una entrada del catálogo **sin banda asignada**.
 *   El sistema ya había visto este tatuaje en otro caso, pero nadie ha determinado
 *   a qué corresponde. No es una pertenencia y no debe presentarse como tal.
 * - `review`: candidato por debajo del umbral firme.
 * - `none`: nada por encima del umbral.
 */
export type MatchType = 'band' | 'unclassified' | 'review' | 'none';
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
  matchType: MatchType;
}
