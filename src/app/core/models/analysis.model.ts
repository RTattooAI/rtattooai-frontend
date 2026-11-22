import { BBox } from './bbox.model';
import { Detection, Match, Verdict } from './detection.model';

export type AnalysisStatus = 'processing' | 'completed' | 'no_detection' | 'failed';

/** Procedencia de la toma: carga desde el equipo o captura con la cámara. */
export type ImageSource = 'archivo' | 'camara';

/** Una de las fotografías del análisis, con su propio estado de procesamiento. */
export interface AnalysisImage {
  id: string;
  order: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  status: AnalysisStatus;
  modelVersion: string | null;
  processingMs: number | null;
  source: ImageSource;
}

export interface Analysis {
  id: string;
  status: AnalysisStatus;
  /** Portada: la primera imagen. El detalle por toma está en `images`. */
  imageUrl: string;
  thumbnailUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: string;
  modelVersion: string | null;
  processingMs: number | null;
  images: AnalysisImage[];
  detections: Detection[];
  disclaimer: string;
  personName: string | null;
  documentId: string | null;
  notes: string | null;
}

export interface AnalysisListItem {
  id: string;
  thumbnailUrl: string | null;
  status: AnalysisStatus;
  createdAt: string;
  topBand: string | null;
  topSimilarity: number | null;
  personName: string | null;
  documentId: string | null;
  imageCount: number;
}

/** Detección del modo asistido en vivo: no se persiste, no tiene identificador. */
export interface PreviewDetection {
  bbox: BBox;
  confidence: number;
  verdict: Verdict;
  matches: Match[];
}

export interface AnalysisPreview {
  imageWidth: number;
  imageHeight: number;
  modelVersion: string;
  processingMs: number;
  detections: PreviewDetection[];
  disclaimer: string;
}
