import { Component, ElementRef, computed, input, output, signal } from '@angular/core';
import { Icon } from '../../ui';

/**
 * Campo de texto con sugerencias: se escribe para filtrar y se puede elegir de la
 * lista o escribir un valor nuevo.
 *
 * Existe porque un `<select>` obliga a que el valor esté previsto de antemano y un
 * `<input>` suelto deja que cada persona escriba «Los Pulpos», «los pulpos» y
 * «Pulpos» para lo mismo. Con esto, lo normal es elegir de la lista y lo excepcional
 * —una banda nueva, una categoría que nadie había usado— sigue siendo posible, y a
 * partir de ese momento aparece en la lista de los demás.
 *
 * Se avisa explícitamente cuando el valor escrito no existe todavía: registrar una
 * banda nueva por un error de tecleo es justo lo que hay que evitar.
 */
@Component({
  selector: 'app-combobox',
  imports: [Icon],
  templateUrl: './combobox.html'
})
export class Combobox {
  readonly options = input<readonly string[]>([]);
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly disabled = input<boolean>(false);

  /** Falso para campos que solo admiten valores existentes. */
  readonly allowCustom = input<boolean>(true);

  /** Texto del aviso cuando lo escrito no está en la lista. */
  readonly customHint = input<string>('No existe todavía: se creará al guardar.');

  readonly valueChange = output<string>();

  readonly isOpen = signal(false);
  readonly query = signal('');
  readonly highlighted = signal(-1);

  /** Lo que se muestra en el campo: mientras está abierto, lo que se está escribiendo. */
  readonly display = computed(() => (this.isOpen() ? this.query() : this.value()));

  readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    const options = this.options();
    if (term === '') {
      return options;
    }
    return options.filter((option) => option.toLowerCase().includes(term));
  });

  /** El valor escrito no coincide con ninguna opción existente. */
  readonly isNew = computed(() => {
    const term = this.query().trim();
    if (term === '') {
      return false;
    }
    return !this.options().some((option) => option.toLowerCase() === term.toLowerCase());
  });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  open(): void {
    if (this.disabled()) {
      return;
    }
    this.query.set(this.value());
    this.highlighted.set(-1);
    this.isOpen.set(true);
  }

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.highlighted.set(-1);
    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
    if (this.allowCustom()) {
      // El valor viaja mientras se escribe: si el usuario guarda sin cerrar el
      // desplegable, lo que ve en el campo es lo que se guarda.
      this.valueChange.emit(this.query());
    }
  }

  select(option: string): void {
    this.query.set(option);
    this.isOpen.set(false);
    this.valueChange.emit(option);
  }

  clear(): void {
    this.query.set('');
    this.valueChange.emit('');
    this.isOpen.set(false);
  }

  onKeyDown(event: KeyboardEvent): void {
    const opciones = this.filtered();

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen()) {
        this.open();
        return;
      }
      const paso = event.key === 'ArrowDown' ? 1 : -1;
      const siguiente = this.highlighted() + paso;
      this.highlighted.set(Math.max(0, Math.min(opciones.length - 1, siguiente)));
      return;
    }

    if (event.key === 'Enter') {
      const marcado = this.highlighted();
      if (this.isOpen() && marcado >= 0 && marcado < opciones.length) {
        event.preventDefault();
        this.select(opciones[marcado]);
      } else if (this.isOpen()) {
        // Enter sobre texto libre confirma lo escrito y cierra, sin enviar el formulario.
        event.preventDefault();
        this.commit();
      }
      return;
    }

    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.isOpen.set(false);
    }
  }

  onBlur(event: FocusEvent): void {
    // Un clic sobre una opción quita el foco del campo antes de disparar el click:
    // si se cerrara de inmediato, la opción nunca llegaría a seleccionarse.
    const destino = event.relatedTarget as Node | null;
    if (destino && this.host.nativeElement.contains(destino)) {
      return;
    }
    this.commit();
  }

  private commit(): void {
    if (!this.isOpen()) {
      return;
    }

    const texto = this.query().trim();
    this.isOpen.set(false);

    if (!this.allowCustom() && this.isNew()) {
      // Solo se admiten valores de la lista: se descarta lo escrito.
      this.valueChange.emit(this.value());
      return;
    }

    this.valueChange.emit(texto);
  }
}
