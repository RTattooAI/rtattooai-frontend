import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/api';
import { Icon, LogoMark } from '../../../shared/ui';

/**
 * Recuperación pública de contraseña (HU0013): antes de esto, una cuenta bloqueada
 * dependía por completo de que un administrador la restableciera a mano. La
 * respuesta es siempre la misma exista o no la cuenta —nunca revela cuál es el
 * caso— porque distinguirlo permitiría enumerar correos válidos desde esta
 * pantalla, que no requiere sesión.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [Icon, LogoMark, RouterLink],
  templateUrl: './forgot-password.html'
})
export class ForgotPassword {
  private readonly authApi = inject(AuthApiService);

  readonly email = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.isSubmitting() || this.email().length === 0) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    this.authApi.forgotPassword(this.email()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(
          err.status === 429
            ? 'Demasiados intentos seguidos. Espere un minuto antes de volver a intentarlo.'
            : 'No se pudo procesar la solicitud. Intente de nuevo.'
        );
      }
    });
  }
}
