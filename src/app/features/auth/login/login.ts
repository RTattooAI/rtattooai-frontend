import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthApiService } from '../../../core/api';
import { AuthService } from '../../../core/auth';
import { Icon, LogoMark } from '../../../shared/ui';

@Component({
  selector: 'app-login',
  imports: [Icon, LogoMark],
  templateUrl: './login.html'
})
export class Login {
  private readonly authApi = inject(AuthApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly remember = signal(true);
  readonly error = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  toggleRemember(event: Event): void {
    this.remember.set((event.target as HTMLInputElement).checked);
  }

  onFormSubmit(event: Event): void {
    event.preventDefault();
    if (this.isSubmitting()) {
      return;
    }

    this.error.set(null);
    this.isSubmitting.set(true);

    this.authApi.login(this.email(), this.password()).subscribe({
      next: (response) => {
        this.authService.setSession(response.token, response.user);
        this.router.navigate(['/upload']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(
          err.status === 401
            ? 'Email o contraseña incorrectos.'
            : 'No se pudo conectar con el servidor. Intenta de nuevo.'
        );
      }
    });
  }
}
