import { describe, expect, it } from 'vitest';
import { LIVE_MIN_PERIOD_MS, LIVE_RATE_LIMIT_PER_MINUTE, pauseBeforeNextFrame } from './live-pacing';

describe('ritmo del modo en vivo', () => {
  it('a ritmo sostenido no supera el límite de peticiones del servidor', () => {
    expect(60_000 / LIVE_MIN_PERIOD_MS).toBeLessThanOrEqual(LIVE_RATE_LIMIT_PER_MINUTE);
  });

  it('con una respuesta rápida espera lo que falta del periodo', () => {
    // Es el caso de la GPU: sin esta espera el bucle agotaba el cupo del minuto.
    expect(pauseBeforeNextFrame(1_000, 1_200)).toBe(LIVE_MIN_PERIOD_MS - 200);
  });

  it('con una respuesta lenta no añade ninguna espera', () => {
    expect(pauseBeforeNextFrame(1_000, 2_100)).toBe(0);
  });
});
