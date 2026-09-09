/**
 * Escalas de confianza del sistema. Son dos, deliberadamente distintas, y antes se
 * contradecían en pantalla:
 *
 *  - SIMILITUD con el catálogo (identificación): decide el semáforo y la etiqueta de
 *    cada candidato. Los cortes coinciden con los parámetros del modelo: por debajo
 *    del umbral operativo (0.55) nada puede ser coincidencia, y 0.75 es el corte de
 *    "coincidencia fuerte" documentado en el OE3.
 *  - CONFIANZA DEL DETECTOR (¿hay un tatuaje aquí?): colorea la caja y decide la
 *    preselección para enrolar. No dice nada sobre a qué banda pertenece.
 */
export const SIMILARITY_STRONG = 75;
export const SIMILARITY_THRESHOLD = 55;

export const DETECTION_HIGH = 80;
export const DETECTION_MEDIUM = 60;

export interface ConfidenceBand {
  label: string;
  ring: string;
  bg: string;
  text: string;
  soft: string;
}

const ALTA: ConfidenceBand = { label: 'Alta', ring: 'ring-emerald-200', bg: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50' };
const MEDIA: ConfidenceBand = { label: 'Media', ring: 'ring-amber-200', bg: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50' };
const BAJA: ConfidenceBand = { label: 'Baja', ring: 'ring-rose-200', bg: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50' };

/** Banda de similitud de una coincidencia (0-100). Alineada con el semáforo. */
export function confidenceBand(pct: number): ConfidenceBand {
  if (pct >= SIMILARITY_STRONG) {
    return ALTA;
  }
  if (pct >= SIMILARITY_THRESHOLD) {
    return MEDIA;
  }
  return BAJA;
}

/** Color de la caja de una detección, según la confianza del detector (0-100). */
export function detectionColor(pct: number): string {
  if (pct >= DETECTION_HIGH) {
    return '#10B981';
  }
  if (pct >= DETECTION_MEDIUM) {
    return '#F59E0B';
  }
  return '#EF4444';
}
