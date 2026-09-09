/** Configuración que el servicio de inferencia tiene cargada ahora mismo. */
export interface RuntimeModel {
  modelVersion: string;
  detector: string;
  embedder: string;
  head: string | null;
  embeddingDim: number;
  threshold: number;
  margin: number;
  detConf: number;
  detIou: number;
  gallerySize: number;
  galleryIdentities: number;
  galleryBands: number;
}

/** Versión registrada del modelo con sus métricas (RF-16). */
export interface ModelVersion {
  id: string;
  identifier: string;
  detector: string | null;
  embedder: string | null;
  head: string | null;
  map50: number | null;
  top1: number | null;
  top5: number | null;
  threshold: number | null;
  margin: number | null;
  source: string | null;
  notes: string | null;
  active: boolean;
  analysesCount: number;
  registeredAt: string;
}

export interface ModelInventory {
  runtime: RuntimeModel | null;
  versions: ModelVersion[];
}
