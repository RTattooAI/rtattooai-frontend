import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/api';
import { Icon, LogoMark } from '../../../shared/ui';

/** Mismo mínimo que `PasswordPolicy` del backend, que sigue siendo quien decide. */
const MIN_LENGTH = 8;

/**
 * Segunda mitad del flujo público de recuperación (HU0013): el enlace del correo
 * trae el token en la URL, nunca se pide a mano. Igual que en el diálogo de cambio
 * de contraseña, aquí solo se comprueba lo que no necesita al servidor —longitud,
 * letras y números, que la confirmación coincida— para no gastar uno de los cinco
 * intentos por minuto en un error de tecleo.
 */
@Component({
  selector: 'app-reset-password',
  imports: [Icon, LogoMark, RouterLink],
  templateUrl: './reset-password.html'
})
export class ResetPassword {
  private readonly authApi = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);

  readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly newPassword = signal('');
  readonly confirmation = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal(false);

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
      !!this.token &&
      this.newPassword().length > 0 &&
      this.confirmation() === this.newPassword() &&
      this.problem() === null &&
      !this.isSubmitting()
  );

  onNewInput(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
  }

  onConfirmationInput(event: Event): void {
    this.confirmation.set((event.target as HTMLInputElement).value);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit() || !this.token) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    this.authApi.resetPassword(this.token, this.newPassword()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.done.set(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(
          err.status === 429
            ? 'Demasiados intentos seguidos. Espere un minuto antes de volver a intentarlo.'
            : (err.error?.error ?? 'No se pudo restablecer la contraseña. Intente de nuevo.')
        );
      }
    });
  }
}
