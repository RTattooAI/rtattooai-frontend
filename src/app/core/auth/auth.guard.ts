import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Si habia un token pero ya caduco, se limpia aqui: la sesion no debe seguir
  // aparentando estar viva hasta que el backend responda 401.
  authService.logout();

  return router.createUrlTree(['/login']);
};
