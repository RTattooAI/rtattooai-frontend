import { Detection } from './detection.model';

export type AnalysisStatus = 'processing' | 'completed' | 'no_detection' | 'failed';

export interface Analysis {
  id: string;
  status: AnalysisStatus;
  imageUrl: string;
  thumbnailUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: string;
  modelVersion: string | null;
  processingMs: number | null;
  detections: Detection[];
  disclaimer: string;
}

export interface AnalysisListItem {
  id: string;
  thumbnailUrl: string | null;
  status: AnalysisStatus;
  createdAt: string;
  topBand: string | null;
  topSimilarity: number | null;
}
