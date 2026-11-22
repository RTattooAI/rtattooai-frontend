import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideKeyRound, LucideLoader, LucideX, provideLucideIcons } from '@lucide/angular';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChangePasswordDialog } from './change-password-dialog';

const URL_CAMBIO = '/api/auth/change-password';

/**
 * El inicio de sesión y el cambio de contraseña comparten un límite de cinco intentos
 * por minuto. Lo que se prueba es que el diálogo no gaste esos intentos en errores que
 * puede ver él mismo, y que lo que decide el servidor llegue a la pantalla sin alterar.
 */
describe('ChangePasswordDialog', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLucideIcons(LucideKeyRound, LucideLoader, LucideX)
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function crear(actual: string, nueva: string, confirmacion = nueva) {
    const fixture = TestBed.createComponent(ChangePasswordDialog);
    const dialogo = fixture.componentInstance;
    dialogo.currentPassword.set(actual);
    dialogo.newPassword.set(nueva);
    dialogo.confirmation.set(confirmacion);
    fixture.detectChanges();
    return fixture;
  }

  it('no envía una contraseña nueva sin números', () => {
    const dialogo = crear('Actual2026', 'soloLetrasLargas').componentInstance;

    expect(dialogo.problem()).toContain('letras y números');
    expect(dialogo.canSubmit()).toBe(false);

    dialogo.submit();
    http.expectNone(URL_CAMBIO);
  });

  it('no envía una contraseña nueva demasiado corta', () => {
    const dialogo = crear('Actual2026', 'ab12').componentInstance;

    expect(dialogo.problem()).toContain('al menos 8');
    dialogo.submit();
    http.expectNone(URL_CAMBIO);
  });

  it('no envía si la confirmación no coincide', () => {
    const dialogo = crear('Actual2026', 'Nueva2026x', 'Nueva2026y').componentInstance;

    expect(dialogo.problem()).toContain('no coincide');
    dialogo.submit();
    http.expectNone(URL_CAMBIO);
  });

  it('envía la actual y la nueva, y avisa al terminar', () => {
    const dialogo = crear('Actual2026', 'Nueva2026x').componentInstance;
    let avisado = false;
    dialogo.changed.subscribe(() => (avisado = true));

    dialogo.submit();

    const req = http.expectOne(URL_CAMBIO);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'Actual2026', newPassword: 'Nueva2026x' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(avisado).toBe(true);
  });

  it('muestra tal cual el motivo que da el servidor', () => {
    const dialogo = crear('Equivocada1', 'Nueva2026x').componentInstance;

    dialogo.submit();
    http
      .expectOne(URL_CAMBIO)
      .flush({ error: 'La contraseña actual no es correcta.' }, { status: 400, statusText: 'Bad Request' });

    expect(dialogo.error()).toBe('La contraseña actual no es correcta.');
    expect(dialogo.isSubmitting()).toBe(false);
  });

  it('ante el límite de intentos explica que hay que esperar', () => {
    const dialogo = crear('Actual2026', 'Nueva2026x').componentInstance;

    dialogo.submit();
    http.expectOne(URL_CAMBIO).flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(dialogo.error()).toContain('Espere un minuto');
  });
});
