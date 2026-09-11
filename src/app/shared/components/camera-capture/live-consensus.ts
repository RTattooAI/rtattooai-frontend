import { AnalysisPreview, PreviewDetection } from '../../../core/models/analysis.model';
import { Verdict } from '../../../core/models/detection.model';

/**
 * Consenso entre fotogramas para el análisis en vivo.
 *
 * **Por qué no basta con mostrar el último fotograma.** Los umbrales del sistema se
 * calibraron sobre una imagen: al 5 % de falsos positivos, una consulta señala a
 * quien no corresponde una vez de cada veinte. Un vídeo no es una consulta, son
 * decenas por segundo. Si la pantalla se quedara con el mejor fotograma, la
 * probabilidad de enseñar al menos una coincidencia falsa sería
 * `1 − 0.95^n`: con 20 fotogramas, el 64 %. El umbral calibrado para una fotografía
 * **no vale tal cual para un flujo continuo**.
 *
 * Aquí no se acumula el máximo sino la coincidencia: un candidato se muestra cuando
 * aparece en varios de los últimos fotogramas, y se reporta la **mediana** de sus
 * similitudes, no la mejor. Un fotograma afortunado deja de bastar, y a cambio el
 * resultado deja de parpadear, que era el otro problema.
 */

export interface ConsensusResult {
  catalogId: string;
  band: string;
  /** Mediana de las similitudes, no el máximo: el máximo es lo que infla el error. */
  similarity: number;
  /** En cuántos de los fotogramas de la ventana salió como mejor candidato. */
  seenIn: number;
  /** Cuántos fotogramas hay en la ventana ahora mismo. */
  frames: number;
  verdict: Verdict;
  /** Ha aparecido lo suficiente como para enseñarlo. */
  stable: boolean;
}

interface FrameTop {
  catalogId: string;
  band: string;
  similarity: number;
  verdict: Verdict;
}

/** Ventana y acuerdo mínimo por defecto: 3 de los últimos 6 fotogramas. */
export const LIVE_WINDOW = 6;
export const LIVE_MIN_AGREEMENT = 3;

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio];
}

/** El mejor candidato de un fotograma, o null si ese fotograma no afirma nada. */
function topDelFotograma(preview: AnalysisPreview | null): FrameTop | null {
  if (!preview || preview.detections.length === 0) {
    return null;
  }

  let mejor: { deteccion: PreviewDetection; similitud: number; banda: string; id: string } | null = null;

  for (const deteccion of preview.detections) {
    if (deteccion.verdict === 'no_match') {
      continue;
    }
    for (const match of deteccion.matches) {
      if (!mejor || match.similarity > mejor.similitud) {
        mejor = {
          deteccion,
          similitud: match.similarity,
          banda: match.band,
          id: match.catalogId
        };
      }
    }
  }

  return mejor
    ? {
        catalogId: mejor.id,
        band: mejor.banda,
        similarity: mejor.similitud,
        verdict: mejor.deteccion.verdict
      }
    : null;
}

export class LiveConsensus {
  /** `null` = ese fotograma no afirmó nada. Se guardan igual: son evidencia en contra. */
  private readonly ventana: (FrameTop | null)[] = [];

  constructor(
    private readonly tamanoVentana: number = LIVE_WINDOW,
    private readonly acuerdoMinimo: number = LIVE_MIN_AGREEMENT
  ) {}

  push(preview: AnalysisPreview | null): void {
    this.ventana.push(topDelFotograma(preview));
    while (this.ventana.length > this.tamanoVentana) {
      this.ventana.shift();
    }
  }

  reset(): void {
    this.ventana.length = 0;
  }

  /** Cuántos de los fotogramas de la ventana no encontraron nada. */
  get framesSinNada(): number {
    return this.ventana.filter((f) => f === null).length;
  }

  get frames(): number {
    return this.ventana.length;
  }

  result(): ConsensusResult | null {
    const porCandidato = new Map<string, FrameTop[]>();
    for (const frame of this.ventana) {
      if (!frame) {
        continue;
      }
      const previos = porCandidato.get(frame.catalogId) ?? [];
      previos.push(frame);
      porCandidato.set(frame.catalogId, previos);
    }

    if (porCandidato.size === 0) {
      return null;
    }

    // Gana el que aparece en más fotogramas; a igualdad, el de mediana más alta.
    let ganador: FrameTop[] | null = null;
    for (const apariciones of porCandidato.values()) {
      if (
        !ganador ||
        apariciones.length > ganador.length ||
        (apariciones.length === ganador.length &&
          mediana(apariciones.map((a) => a.similarity)) >
            mediana(ganador.map((a) => a.similarity)))
      ) {
        ganador = apariciones;
      }
    }

    if (!ganador) {
      return null;
    }

    const similitudes = ganador.map((a) => a.similarity);
    const coincidencias = ganador.filter((a) => a.verdict === 'match').length;

    return {
      catalogId: ganador[0].catalogId,
      band: ganador[0].band,
      similarity: mediana(similitudes),
      seenIn: ganador.length,
      frames: this.ventana.length,
      // Solo se sostiene «coincidencia» si la mayoría de sus fotogramas la sostuvo.
      // Ante el empate se elige revisión: afirmar de más es el error caro aquí.
      verdict: coincidencias > ganador.length / 2 ? 'match' : 'review',
      stable: ganador.length >= this.acuerdoMinimo
    };
  }
}
