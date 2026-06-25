export interface CatalogItem {
  catalogId: string;
  band: string | null;
  imageUrl: string;
  source: string;
  addedBy: string;
  addedAt: string;
  validated: boolean;
  originAnalysisId: string | null;
}
