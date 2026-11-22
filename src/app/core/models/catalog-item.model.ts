export interface CatalogItem {
  catalogId: string;
  band: string | null;
  imageUrl: string;
  source: string;
  addedBy: string;
  addedAt: string;
  validated: boolean;
  originAnalysisId: string | null;
  bandId: string | null;
  name: string | null;
  description: string | null;
  category: string | null;
  bodyLocation: string | null;
  tags: string[];
}

/** Campos descriptivos editables de una entrada del catálogo (RF-09). */
export interface CatalogMetadata {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  bodyLocation?: string | null;
  /** Etiquetas separadas por coma; el backend las normaliza. */
  tags?: string | null;
}

export interface CatalogFilters {
  band?: string;
  category?: string;
  bodyLocation?: string;
  tag?: string;
  validated?: boolean;
  q?: string;
  /**
   * Solo entradas sin banda asignada. Es la bandeja de trabajo de supervisión:
   * tatuajes que el sistema ya reconoce y que nadie ha clasificado todavía.
   */
  pendingBand?: boolean;
}

/** Valores que existen en el catálogo, para poblar los desplegables de filtro. */
export interface CatalogFacets {
  bands: string[];
  categories: string[];
  bodyLocations: string[];
  tags: string[];
}
