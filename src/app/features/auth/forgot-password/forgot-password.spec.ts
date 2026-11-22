import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { LucideArrowLeft, LucideArrowRight, LucideCheckCircle2, LucideLoader, LucideMail, provideLucideIcons } from '@lucide/angular';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ForgotPassword } from './forgot-password';

const URL_OLVIDE = '/api/auth/forgot-password';

/**
 * La respuesta del servidor es siempre la misma exista o no la cuenta (para no poder
 * enumerar correos), así que lo único que hay que probar en la pantalla es que
 * cualquier 200 se muestre como éxito y que los errores de red/límite se expliquen.
 */
describe('ForgotPassword', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideLucideIcons(LucideMail, LucideLoader, LucideArrowRight, LucideArrowLeft, LucideCheckCircle2)
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('no envía si el correo está vacío', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();

    fixture.componentInstance.onSubmit(new Event('submit'));

    http.expectNone(URL_OLVIDE);
  });

  it('envía el correo y muestra el aviso de éxito', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    const pantalla = fixture.componentInstance;
    pantalla.email.set('analista@pnp.gob.pe');
    fixture.detectChanges();

    pantalla.onSubmit(new Event('submit'));

    const req = http.expectOne(URL_OLVIDE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'analista@pnp.gob.pe' });
    req.flush({ message: 'ok' });

    expect(pantalla.sent()).toBe(true);
    expect(pantalla.isSubmitting()).toBe(false);
  });

  it('muestra el mismo aviso de éxito aunque el correo no exista, sin distinguirlo', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    const pantalla = fixture.componentInstance;
    pantalla.email.set('nadie@pnp.gob.pe');
    fixture.detectChanges();

    pantalla.onSubmit(new Event('submit'));

    http.expectOne(URL_OLVIDE).flush({ message: 'ok' });

    expect(pantalla.sent()).toBe(true);
  });

  it('ante el límite de intentos explica que hay que esperar', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    const pantalla = fixture.componentInstance;
    pantalla.email.set('analista@pnp.gob.pe');
    fixture.detectChanges();

    pantalla.onSubmit(new Event('submit'));
    http.expectOne(URL_OLVIDE).flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(pantalla.error()).toContain('Espere un minuto');
    expect(pantalla.sent()).toBe(false);
  });

  it('ante un fallo de conexión muestra un mensaje genérico', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    const pantalla = fixture.componentInstance;
    pantalla.email.set('analista@pnp.gob.pe');
    fixture.detectChanges();

    pantalla.onSubmit(new Event('submit'));
    http.expectOne(URL_OLVIDE).flush(null, { status: 0, statusText: 'Unknown Error' });

    expect(pantalla.error()).toBe('No se pudo procesar la solicitud. Intente de nuevo.');
  });
});
