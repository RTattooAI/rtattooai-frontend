import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { LucideArrowLeft, LucideCheckCircle2, LucideLoader, LucideLock, provideLucideIcons } from '@lucide/angular';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResetPassword } from './reset-password';

const URL_RESTABLECER = '/api/auth/reset-password';

function activatedRouteConToken(token: string | null) {
  return {
    provide: ActivatedRoute,
    useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } }
  };
}

describe('ResetPassword', () => {
  let http: HttpTestingController;

  function crear(token: string | null, nueva = '', confirmacion = nueva) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideLucideIcons(LucideLock, LucideLoader, LucideArrowLeft, LucideCheckCircle2),
        activatedRouteConToken(token)
      ]
    });
    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ResetPassword);
    const pantalla = fixture.componentInstance;
    pantalla.newPassword.set(nueva);
    pantalla.confirmation.set(confirmacion);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    http.verify();
  });

  it('sin token en la URL no deja enviar nada', () => {
    const pantalla = crear(null, 'Nueva2026x').componentInstance;

    expect(pantalla.canSubmit()).toBe(false);
    pantalla.onSubmit(new Event('submit'));
    http.expectNone(URL_RESTABLECER);
  });

  it('no envía una contraseña nueva sin números', () => {
    const pantalla = crear('token-valido', 'soloLetrasLargas').componentInstance;

    expect(pantalla.problem()).toContain('letras y números');
    pantalla.onSubmit(new Event('submit'));
    http.expectNone(URL_RESTABLECER);
  });

  it('no envía si la confirmación no coincide', () => {
    const pantalla = crear('token-valido', 'Nueva2026x', 'Nueva2026y').componentInstance;

    expect(pantalla.problem()).toContain('no coincide');
    pantalla.onSubmit(new Event('submit'));
    http.expectNone(URL_RESTABLECER);
  });

  it('envía el token y la nueva contraseña, y avisa al terminar', () => {
    const pantalla = crear('token-valido', 'Nueva2026x').componentInstance;

    pantalla.onSubmit(new Event('submit'));

    const req = http.expectOne(URL_RESTABLECER);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'token-valido', newPassword: 'Nueva2026x' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(pantalla.done()).toBe(true);
  });

  it('muestra tal cual el motivo que da el servidor cuando el enlace ya no sirve', () => {
    const pantalla = crear('token-caducado', 'Nueva2026x').componentInstance;

    pantalla.onSubmit(new Event('submit'));
    http
      .expectOne(URL_RESTABLECER)
      .flush({ error: 'El enlace no es válido o ya caducó. Solicítelo de nuevo.' }, { status: 400, statusText: 'Bad Request' });

    expect(pantalla.error()).toBe('El enlace no es válido o ya caducó. Solicítelo de nuevo.');
    expect(pantalla.done()).toBe(false);
  });

  it('ante el límite de intentos explica que hay que esperar', () => {
    const pantalla = crear('token-valido', 'Nueva2026x').componentInstance;

    pantalla.onSubmit(new Event('submit'));
    http.expectOne(URL_RESTABLECER).flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(pantalla.error()).toContain('Espere un minuto');
  });
});
