import { describe, expect, it } from 'vitest';
import {
  DETECTION_HIGH,
  SIMILARITY_STRONG,
  SIMILARITY_THRESHOLD,
  confidenceBand,
  detectionColor
} from './confidence';

describe('escala de similitud', () => {
  it('marca como Alta a partir del corte de coincidencia fuerte', () => {
    expect(confidenceBand(SIMILARITY_STRONG).label).toBe('Alta');
    expect(confidenceBand(92).label).toBe('Alta');
  });

  it('marca como Media entre el umbral operativo y el corte fuerte', () => {
    expect(confidenceBand(SIMILARITY_THRESHOLD).label).toBe('Media');
    expect(confidenceBand(SIMILARITY_STRONG - 1).label).toBe('Media');
  });

  it('marca como Baja por debajo del umbral operativo del modelo', () => {
    expect(confidenceBand(SIMILARITY_THRESHOLD - 1).label).toBe('Baja');
    expect(confidenceBand(0).label).toBe('Baja');
  });

  it('coincide con el semáforo: un 78% no puede ser verde y "Media" a la vez', () => {
    // Antes el semáforo cortaba en 75 y la etiqueta en 80, así que 78% salía
    // simultáneamente como "coincidencia fuerte" y como confianza "Media".
    expect(confidenceBand(78).label).toBe('Alta');
  });
});

describe('escala del detector', () => {
  it('usa sus propios cortes, independientes de la similitud', () => {
    expect(detectionColor(DETECTION_HIGH)).toBe('#10B981');
    expect(detectionColor(70)).toBe('#F59E0B');
    expect(detectionColor(40)).toBe('#EF4444');
  });
});
