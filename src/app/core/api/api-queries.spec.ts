import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnalysisService } from './analysis.service';
import { AuditService } from './audit.service';
import { BandsService } from './bands.service';
import { CatalogService } from './catalog.service';
import { UsersService } from './users.service';

/**
 * Estas pruebas fijan cómo se construyen las peticiones. Los filtros y la paginación
 * se resuelven en el servidor, así que un parámetro que se pierda por el camino no
 * rompe nada visiblemente: simplemente devuelve otra cosa. Aquí queda comprobado.
 */
describe('construcción de peticiones', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('historial (RF-13)', () => {
    it('envía alcance, filtros y paginación', () => {
      TestBed.inject(AnalysisService)
        .list('all', { from: '2026-09-01', to: '2026-09-09', status: 'completed', q: 'pulpos' }, 3, 50)
        .subscribe();

      const req = http.expectOne((r) => r.url === '/api/analyses');
      expect(req.request.params.get('scope')).toBe('all');
      expect(req.request.params.get('from')).toBe('2026-09-01');
      expect(req.request.params.get('to')).toBe('2026-09-09');
      expect(req.request.params.get('status')).toBe('completed');
      expect(req.request.params.get('q')).toBe('pulpos');
      expect(req.request.params.get('page')).toBe('3');
      expect(req.request.params.get('pageSize')).toBe('50');
      req.flush({ items: [], total: 0, page: 3, pageSize: 50, totalPages: 0 });
    });

    it('omite los filtros vacíos en vez de mandarlos en blanco', () => {
      TestBed.inject(AnalysisService).list('mine').subscribe();

      const req = http.expectOne((r) => r.url === '/api/analyses');
      expect(req.request.params.has('from')).toBe(false);
      expect(req.request.params.has('status')).toBe(false);
      expect(req.request.params.has('q')).toBe(false);
      req.flush({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 });
    });

    it('la exportación arrastra los mismos filtros que la vista', () => {
      TestBed.inject(AnalysisService).exportCsv('all', { from: '2026-09-01', status: 'failed' }).subscribe();

      const req = http.expectOne((r) => r.url === '/api/analyses/export');
      expect(req.request.params.get('from')).toBe('2026-09-01');
      expect(req.request.params.get('status')).toBe('failed');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob());
    });
  });

  describe('análisis con cargas y tomas de la cámara (HU0020)', () => {
    it('envía la procedencia de cada fotografía en el mismo orden que las imágenes', () => {
      const carga = new File(['a'], 'carga.jpg', { type: 'image/jpeg' });
      const toma = new File(['b'], 'toma.jpg', { type: 'image/jpeg' });

      TestBed.inject(AnalysisService).create([carga, toma], '', '', '', ['archivo', 'camara']).subscribe();

      const req = http.expectOne((r) => r.url === '/api/analyses');
      const body = req.request.body as FormData;
      expect(body.getAll('images')).toHaveLength(2);
      expect(body.getAll('sources')).toEqual(['archivo', 'camara']);
      // En una mezcla, el campo antiguo no puede decir «camara» de todo el análisis.
      expect(body.get('source')).toBe('archivo');
      req.flush({ id: 'a1', detections: [] });
    });
  });

  describe('catálogo (RF-09)', () => {
    it('envía los filtros descriptivos', () => {
      TestBed.inject(CatalogService)
        .list({ category: 'Símbolo', bodyLocation: 'Antebrazo', tag: 'corona', validated: false, q: 'tat' })
        .subscribe();

      const req = http.expectOne((r) => r.url === '/api/catalog');
      expect(req.request.params.get('category')).toBe('Símbolo');
      expect(req.request.params.get('bodyLocation')).toBe('Antebrazo');
      expect(req.request.params.get('tag')).toBe('corona');
      expect(req.request.params.get('validated')).toBe('false');
      req.flush([]);
    });

    it('no confunde "sin filtrar" con "validated=false"', () => {
      TestBed.inject(CatalogService).list({}).subscribe();

      const req = http.expectOne((r) => r.url === '/api/catalog');
      expect(req.request.params.has('validated')).toBe(false);
      req.flush([]);
    });

    it('el enrolamiento adjunta imagen, banda y campos descriptivos', () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'tatuaje.jpg', { type: 'image/jpeg' });

      TestBed.inject(CatalogService)
        .enroll(file, 'Los Pulpos', { category: 'Símbolo', tags: 'corona, puntas', description: null })
        .subscribe();

      const req = http.expectOne('/api/catalog');
      const body = req.request.body as FormData;
      expect(body.get('band')).toBe('Los Pulpos');
      expect(body.get('category')).toBe('Símbolo');
      expect(body.get('tags')).toBe('corona, puntas');
      // Un campo vacío no viaja: el backend lo interpretaría como "ponlo en blanco".
      expect(body.has('description')).toBe(false);
      req.flush({});
    });
  });

  describe('bandas (RF-10)', () => {
    it('crea con PUT y borra con DELETE sobre su identificador', () => {
      const service = TestBed.inject(BandsService);

      service.update('b-1', { name: 'Los Pulpos', dangerLevel: 'alto' }).subscribe();
      const put = http.expectOne('/api/bands/b-1');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ name: 'Los Pulpos', dangerLevel: 'alto' });
      put.flush({});

      service.remove('b-1').subscribe();
      const del = http.expectOne('/api/bands/b-1');
      expect(del.request.method).toBe('DELETE');
      del.flush(null);
    });
  });

  describe('auditoría (RF-17)', () => {
    it('filtra y pagina el registro', () => {
      TestBed.inject(AuditService).list({ action: 'POST', userEmail: 'perito@pnp.gob.pe' }, 2, 100).subscribe();

      const req = http.expectOne((r) => r.url === '/api/audit');
      expect(req.request.params.get('action')).toBe('POST');
      expect(req.request.params.get('userEmail')).toBe('perito@pnp.gob.pe');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('100');
      req.flush({ items: [], total: 0, page: 2, pageSize: 100, totalPages: 0 });
    });

    it('la exportación pide un blob', () => {
      TestBed.inject(AuditService).exportCsv({ from: '2026-09-01' }).subscribe();

      const req = http.expectOne((r) => r.url === '/api/audit/export');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob());
    });
  });

  describe('usuarios (RF-12)', () => {
    it('envía la dependencia policial al crear y al editar', () => {
      const service = TestBed.inject(UsersService);

      service.create('Perito Uno', 'p@pnp.gob.pe', 'password123', 'analyst', 'DIRINCRI Lima').subscribe();
      const post = http.expectOne('/api/users');
      expect(post.request.body.dependency).toBe('DIRINCRI Lima');
      post.flush({});

      service.update('u-1', 'Perito Uno', 'supervisor', null).subscribe();
      const put = http.expectOne('/api/users/u-1');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ fullName: 'Perito Uno', role: 'supervisor', dependency: null });
      put.flush({});
    });
  });
});
