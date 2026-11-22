import { Component, computed, input, output, signal } from '@angular/core';
import { Icon } from '../../ui';

/** Mismos topes que aplica el backend (CatalogTags). */
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 30;

/**
 * Etiquetas como fichas, con sugerencias de las ya usadas.
 *
 * Antes era un campo de texto donde había que escribir «corona, puntas» separando
 * por comas a mano. El problema no era la comodidad: era que nadie veía qué
 * etiquetas existían ya, así que el catálogo acumulaba «corona», «coronas» y
 * «Corona» como si fueran cosas distintas, y filtrar por etiqueta dejaba de servir.
 *
 * Se normaliza igual que en el servidor —minúsculas, sin repetidos, con tope— para
 * que lo que se ve al escribir sea lo que se guarda.
 */
@Component({
  selector: 'app-tag-input',
  imports: [Icon],
  templateUrl: './tag-input.html'
})
export class TagInput {
  /** Etiquetas actuales, separadas por coma (el formato con el que viajan). */
  readonly value = input<string>('');
  readonly suggestions = input<readonly string[]>([]);
  readonly placeholder = input<string>('Escriba y pulse Intro');

  readonly valueChange = output<string>();

  readonly draft = signal('');
  readonly isFocused = signal(false);

  readonly maxTags = MAX_TAGS;

  readonly tags = computed(() => split(this.value()));

  readonly isFull = computed(() => this.tags().length >= MAX_TAGS);

  /** Sugerencias que no se han usado ya y que casan con lo que se está escribiendo. */
  readonly available = computed(() => {
    const actuales = new Set(this.tags());
    const term = this.draft().trim().toLowerCase();

    return this.suggestions()
      .map((s) => s.toLowerCase())
      .filter((s) => !actuales.has(s) && (term === '' || s.includes(term)))
      .slice(0, 12);
  });

  onDraftInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;

    // Escribir una coma equivale a confirmar la etiqueta: es como la gente
    // escribe listas, y así el hábito anterior sigue funcionando.
    if (raw.includes(',')) {
      const partes = raw.split(',');
      const ultima = partes.pop() ?? '';
      for (const parte of partes) {
        this.add(parte);
      }
      this.draft.set(ultima);
      return;
    }

    this.draft.set(raw);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.add(this.draft());
      this.draft.set('');
      return;
    }

    // Retroceso con el campo vacío quita la última ficha, que es lo que espera
    // cualquiera que haya usado un campo de etiquetas antes.
    if (event.key === 'Backspace' && this.draft() === '' && this.tags().length > 0) {
      event.preventDefault();
      this.remove(this.tags()[this.tags().length - 1]);
    }
  }

  onBlur(): void {
    this.isFocused.set(false);
    if (this.draft().trim() !== '') {
      this.add(this.draft());
      this.draft.set('');
    }
  }

  add(raw: string): void {
    const tag = normalize(raw);
    if (!tag || this.isFull() || this.tags().includes(tag)) {
      return;
    }

    this.valueChange.emit([...this.tags(), tag].join(','));
  }

  remove(tag: string): void {
    this.valueChange.emit(this.tags().filter((t) => t !== tag).join(','));
  }
}

function normalize(raw: string): string {
  const tag = raw.trim().toLowerCase();
  return tag.length > MAX_TAG_LENGTH ? tag.slice(0, MAX_TAG_LENGTH) : tag;
}

function split(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}
