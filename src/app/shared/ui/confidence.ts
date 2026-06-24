/**
 * Similarity / detection-confidence band styling, mirroring the Claude Design
 * `semaforoColor` helper. Input is a 0–100 percentage.
 *
 * Note: this is the per-match similarity band (Alta/Media/Baja). The verdict-driven
 * support traffic-light (rojo/amarillo/verde) lives in `confidence-semaforo`.
 */
export interface ConfidenceBand {
  label: string;
  ring: string;
  bg: string;
  text: string;
  soft: string;
}

export function confidenceBand(pct: number): ConfidenceBand {
  if (pct >= 80) {
    return { label: 'Alta', ring: 'ring-emerald-200', bg: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50' };
  }
  if (pct >= 60) {
    return { label: 'Media', ring: 'ring-amber-200', bg: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50' };
  }
  return { label: 'Baja', ring: 'ring-rose-200', bg: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50' };
}

/** Hex colour for a detection bounding box, by detection-confidence percentage. */
export function detectionColor(pct: number): string {
  if (pct >= 80) {
    return '#10B981';
  }
  if (pct >= 60) {
    return '#F59E0B';
  }
  return '#EF4444';
}
