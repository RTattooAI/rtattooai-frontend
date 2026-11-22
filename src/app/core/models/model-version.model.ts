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

/**
 * Coherencia entre el catálogo y la galería del servicio de inferencia. Cada lista es
 * una manera de que el sistema se equivoque sin dar ningún error.
 */
export interface GalleryConsistency {
  serviceAvailable: boolean;
  catalogEntries: number;
  galleryIdentities: number;
  /** Fichas sin vectores: el sistema nunca las reconocerá. */
  missingInGallery: string[];
  /** Vectores sin ficha. */
  orphansInGallery: string[];
  /** El código guarda vectores de una imagen distinta a la de su ficha. */
  imageMismatch: string[];
  /** Códigos que comparten un mismo vector. */
  sharedVectors: string[][];
  /** Presentes en ambos lados, pero enrolados antes de que existiera la huella de imagen. */
  unverified: number;
  consistent: boolean;
}

export interface GalleryRepairResult {
  reenrolled: string[];
  removed: string[];
  failed: { catalogId: string; reason: string }[];
  after: GalleryConsistency;
}
