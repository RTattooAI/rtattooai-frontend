/**
 * Escalas de confianza del sistema. Son dos, deliberadamente distintas, y antes se
 * contradecían en pantalla:
 *
 *  - SIMILITUD con el catálogo (identificación): decide el semáforo y la etiqueta de
 *    cada candidato. Los cortes son **los mismos que usa el modelo para decidir**,
 *    no una escala aparte: 0.70 es el umbral firme y 0.55 el de revisión, calibrados
 *    con datos reales para una tasa de falsos positivos del 5 % sobre la galería
 *    actual. Si estas constantes y `match_config.json` se separan, la pantalla dirá
 *    una cosa y el sistema hará otra — el problema que ya hubo con los cortes 75/55.
 *
 *    Está medido que el umbral necesario **sube conforme crece el catálogo**: al
 *    mismo 5 % de falsos positivos hacen falta 0.665 con 50 identidades y 0.89 con
 *    400. Cuando se recalibre `match_config.json` hay que mover también esto.
 *  - CONFIANZA DEL DETECTOR (¿hay un tatuaje aquí?): colorea la caja y decide la
 *    preselección para enrolar. No dice nada sobre a qué banda pertenece.
 */
export const SIMILARITY_STRONG = 70;
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
