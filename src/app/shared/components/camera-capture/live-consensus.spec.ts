import { describe, expect, it } from 'vitest';
import { AnalysisPreview } from '../../../core/models/analysis.model';
import { Verdict } from '../../../core/models/detection.model';
import { LiveConsensus } from './live-consensus';

function frame(
  candidatos: { id: string; band?: string; similarity: number; verdict?: Verdict }[]
): AnalysisPreview {
  return {
    imageWidth: 640,
    imageHeight: 480,
    modelVersion: 'prueba',
    processingMs: 10,
    disclaimer: '',
    detections: candidatos.map((c) => ({
      bbox: { x: 0, y: 0, width: 10, height: 10 },
      confidence: 0.9,
      verdict: c.verdict ?? 'match',
      matches: [
        {
          catalogId: c.id,
          band: c.band ?? 'Los Pulpos',
          similarity: c.similarity,
          referenceImageUrl: null
        }
      ]
    }))
  };
}

/** Fotograma que no encontró nada. */
const vacio: AnalysisPreview = {
  imageWidth: 640,
  imageHeight: 480,
  modelVersion: 'prueba',
  processingMs: 10,
  disclaimer: '',
  detections: []
};

describe('LiveConsensus', () => {
  it('no sostiene nada con un solo fotograma', () => {
    const c = new LiveConsensus(6, 3);
    c.push(frame([{ id: 'tat_01', similarity: 0.95 }]));

    // Hay candidato, pero todavía no ha aparecido lo suficiente.
    expect(c.result()?.stable).toBe(false);
  });

  it('sostiene un candidato cuando se repite en la ventana', () => {
    const c = new LiveConsensus(6, 3);
    c.push(frame([{ id: 'tat_01', similarity: 0.9 }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.86 }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.88 }]));

    const r = c.result();
    expect(r?.stable).toBe(true);
    expect(r?.catalogId).toBe('tat_01');
    expect(r?.seenIn).toBe(3);
  });

  it('reporta la mediana y no el mejor fotograma', () => {
    // Este es el punto: un fotograma afortunado no debe decidir. Si se reportara el
    // máximo, bastaría un 0.99 suelto para afirmar una coincidencia.
    const c = new LiveConsensus(6, 3);
    c.push(frame([{ id: 'tat_01', similarity: 0.6 }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.62 }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.99 }]));

    expect(c.result()?.similarity).toBeCloseTo(0.62, 5);
  });

  it('un candidato esporádico no le gana al que se repite', () => {
    const c = new LiveConsensus(6, 3);
    c.push(frame([{ id: 'tat_01', similarity: 0.7 }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.72 }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.71 }]));
    c.push(frame([{ id: 'impostor', similarity: 0.98 }]));

    const r = c.result();
    expect(r?.catalogId).toBe('tat_01');
    expect(r?.seenIn).toBe(3);
  });

  it('ante el empate de veredictos elige revisión, no coincidencia', () => {
    const c = new LiveConsensus(6, 2);
    c.push(frame([{ id: 'tat_01', similarity: 0.75, verdict: 'match' }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.6, verdict: 'review' }]));

    expect(c.result()?.verdict).toBe('review');
  });

  it('sostiene coincidencia cuando la mayoría de sus fotogramas la sostuvo', () => {
    const c = new LiveConsensus(6, 2);
    c.push(frame([{ id: 'tat_01', similarity: 0.8, verdict: 'match' }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.82, verdict: 'match' }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.6, verdict: 'review' }]));

    expect(c.result()?.verdict).toBe('match');
  });

  it('la ventana olvida lo viejo', () => {
    const c = new LiveConsensus(3, 2);
    c.push(frame([{ id: 'viejo', similarity: 0.9 }]));
    c.push(frame([{ id: 'nuevo', similarity: 0.8 }]));
    c.push(frame([{ id: 'nuevo', similarity: 0.81 }]));
    c.push(frame([{ id: 'nuevo', similarity: 0.82 }]));

    const r = c.result();
    expect(r?.catalogId).toBe('nuevo');
    expect(c.frames).toBe(3);
  });

  it('los fotogramas sin nada cuentan como evidencia en contra', () => {
    const c = new LiveConsensus(6, 3);
    c.push(frame([{ id: 'tat_01', similarity: 0.9 }]));
    c.push(vacio);
    c.push(vacio);

    expect(c.framesSinNada).toBe(2);
    expect(c.result()?.stable).toBe(false);
  });

  it('sin ningún fotograma no hay resultado', () => {
    expect(new LiveConsensus().result()).toBeNull();
  });

  it('descarta los fotogramas cuyo veredicto fue no_match', () => {
    const c = new LiveConsensus(6, 2);
    c.push(frame([{ id: 'tat_01', similarity: 0.2, verdict: 'no_match' }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.2, verdict: 'no_match' }]));

    expect(c.result()).toBeNull();
    expect(c.framesSinNada).toBe(2);
  });

  it('reset vacía la ventana', () => {
    const c = new LiveConsensus(6, 2);
    c.push(frame([{ id: 'tat_01', similarity: 0.9 }]));
    c.push(frame([{ id: 'tat_01', similarity: 0.9 }]));
    c.reset();

    expect(c.result()).toBeNull();
    expect(c.frames).toBe(0);
  });
});
