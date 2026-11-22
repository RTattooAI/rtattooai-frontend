/**
 * Ritmo del modo en vivo.
 *
 * El backend admite 90 fotogramas por minuto por dirección IP (política
 * «LivePreview»). Con la inferencia en CPU cada fotograma tardaba cerca de un segundo
 * y bastaba con esperar la respuesta. Con la cabeza en GPU responde en unos 200 ms, y
 * la pausa fija de 250 ms que había tras cada respuesta llevaba el bucle a más de dos
 * fotogramas por segundo: el cupo se agotaba hacia los cuarenta segundos y el resto
 * del minuto cada fotograma volvía con 429, justo mientras el consenso intentaba
 * estabilizarse.
 *
 * Por eso el ritmo se mide de inicio a inicio y no como pausa tras la respuesta: sea
 * cual sea la latencia, no sale más de un fotograma cada `LIVE_MIN_PERIOD_MS`.
 */
export const LIVE_RATE_LIMIT_PER_MINUTE = 90;
export const LIVE_MIN_PERIOD_MS = 700;

/** Cuánto esperar antes del siguiente fotograma, sabiendo cuándo salió el anterior. */
export function pauseBeforeNextFrame(startedAtMs: number, nowMs: number, periodMs = LIVE_MIN_PERIOD_MS): number {
  return Math.max(periodMs - (nowMs - startedAtMs), 0);
}
