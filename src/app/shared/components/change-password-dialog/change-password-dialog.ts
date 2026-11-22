import { Component, computed, inject, output, signal } from '@angular/core';
import { AuthApiService } from '../../../core/api';
import { Icon } from '../../ui';

/** Mismo mínimo que `PasswordPolicy` del backend, que sigue siendo quien decide. */
const MIN_LENGTH = 8;

/**
 * Cambio de contraseña por el propio usuario (HU0013). Antes solo existía el endpoint:
 * para cambiarla había que pedir a un administrador que la restableciera, y eso obliga
 * a que otra persona llegue a conocerla.
 *
 * Aquí se comprueba lo que se puede comprobar sin preguntar al servidor —longitud,
 * letras y números, que la confirmación coincida— para no gastar uno de los cinco
 * intentos por minuto en un error de tecleo. La lista de contraseñas comunes y la
 * regla del correo solo las conoce el backend, y su mensaje se muestra tal cual.
 */
@Component({
  selector: 'app-change-password-dialog',
  imports: [Icon],
  templateUrl: './change-password-dialog.html'
})
export class ChangePasswordDialog {
  private readonly authApi = inject(AuthApiService);

  readonly closed = output<void>();
  readonly changed = output<void>();

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmation = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  /** Por qué la nueva contraseña no se enviaría; null mientras no haya nada que objetar. */
  readonly problem = computed<string | null>(() => {
    const nueva = this.newPassword();
    if (nueva.length === 0) {
      return null;
    }
    if (nueva.length < MIN_LENGTH) {
      return `La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
    }
    if (!/\p{L}/u.test(nueva) || !/\p{Nd}/u.test(nueva)) {
      return 'La nueva contraseña debe combinar letras y números.';
    }
    if (this.confirmation().length > 0 && this.confirmation() !== nueva) {
      return 'La confirmación no coincide con la nueva contraseña.';
    }
    return null;
  });

  readonly canSubmit = computed(
    () =>
      this.currentPassword().length > 0 &&
      this.newPassword().length > 0 &&
      this.confirmation() === this.newPassword() &&
      this.problem() === null &&
      !this.isSubmitting()
  );

  onCurrentInput(event: Event): void {
    this.currentPassword.set((event.target as HTMLInputElement).value);
  }

  onNewInput(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
  }

  onConfirmationInput(event: Event): void {
    this.confirmation.set((event.target as HTMLInputElement).value);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    this.authApi.changePassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.changed.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(
          err.status === 429
            ? 'Demasiados intentos seguidos. Espere un minuto antes de volver a intentarlo.'
            : (err.error?.error ?? 'No se pudo cambiar la contraseña. Intente de nuevo.')
        );
      }
    });
  }
}
