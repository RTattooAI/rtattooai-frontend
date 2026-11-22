/** Nivel de peligro de una banda. El backend solo admite estos tres valores. */
export type DangerLevel = 'bajo' | 'medio' | 'alto';

/** Banda criminal del catálogo de referencia (RF-10). */
export interface Band {
  id: string;
  name: string;
  alias: string | null;
  region: string | null;
  dangerLevel: DangerLevel | null;
  description: string | null;
  active: boolean;
  /** Cuántos tatuajes del catálogo están asociados a la banda. */
  tattooCount: number;
  createdAt: string;
}

export interface SaveBandRequest {
  name: string;
  alias?: string | null;
  region?: string | null;
  dangerLevel?: DangerLevel | null;
  description?: string | null;
}
