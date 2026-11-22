import { Component, computed, input } from '@angular/core';
import { Verdict } from '../../../core/models';
import { SIMILARITY_STRONG } from '../../ui/confidence';

type SemaforoLevel = 'rojo' | 'amarillo' | 'verde';

/** Mismo corte que la etiqueta "Alta" de cada candidato: una sola escala en pantalla. */
const GREEN_THRESHOLD = SIMILARITY_STRONG / 100;

interface LevelStyle {
  label: string;
  container: string;
  dot: string;
  text: string;
}

const STYLES: Record<SemaforoLevel, LevelStyle> = {
  rojo: { label: 'Sin coincidencia confiable', container: 'bg-rose-50 ring-rose-200', dot: 'bg-rose-500', text: 'text-rose-700' },
  amarillo: { label: 'Confianza media', container: 'bg-amber-50 ring-amber-200', dot: 'bg-amber-500', text: 'text-amber-700' },
  verde: { label: 'Confianza alta', container: 'bg-emerald-50 ring-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' }
};

const MESSAGES: Record<SemaforoLevel, string> = {
  rojo: 'El sistema no encontró una coincidencia confiable.',
  amarillo: 'Posible coincidencia; requiere validación.',
  verde: 'Coincidencia fuerte; aún requiere validación humana.'
};

@Component({
  selector: 'app-confidence-semaforo',
  templateUrl: './confidence-semaforo.html'
})
export class ConfidenceSemaforo {
  readonly verdict = input.required<Verdict>();
  readonly similarity = input<number | null>(null);

  readonly level = computed<SemaforoLevel>(() => {
    if (this.verdict() === 'no_match') {
      return 'rojo';
    }
    // Un veredicto de revisión nunca es verde, por alta que salga la similitud: el
    // modelo ya decidió que no llega al umbral firme, y pintarlo en verde diría en
    // pantalla lo contrario de lo que el sistema concluyó.
    if (this.verdict() === 'review') {
      return 'amarillo';
    }
    return (this.similarity() ?? 0) >= GREEN_THRESHOLD ? 'verde' : 'amarillo';
  });

  readonly style = computed<LevelStyle>(() => STYLES[this.level()]);
  readonly message = computed<string>(() => MESSAGES[this.level()]);
}
