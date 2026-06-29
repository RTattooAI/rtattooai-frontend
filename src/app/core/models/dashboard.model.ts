export interface AnalysesByStatus {
  completed: number;
  processing: number;
  noDetection: number;
  failed: number;
}

export interface DetectionsByValidation {
  pending: number;
  validated: number;
  review: number;
  dismissed: number;
}

export interface CatalogMetrics {
  total: number;
  validated: number;
  bands: number;
  pendingBand: number;
}

export interface UsersByRole {
  analyst: number;
  supervisor: number;
  admin: number;
}

export interface UsersMetrics {
  total: number;
  active: number;
  byRole: UsersByRole;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface TopBand {
  band: string;
  count: number;
}

export interface DashboardMetrics {
  totalAnalyses: number;
  analysesByStatus: AnalysesByStatus;
  detectionsByValidation: DetectionsByValidation;
  catalog: CatalogMetrics;
  users: UsersMetrics;
  avgProcessingMs: number | null;
  analysesLast30Days: DailyCount[];
  topBands: TopBand[];
}
