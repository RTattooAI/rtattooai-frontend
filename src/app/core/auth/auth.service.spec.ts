import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { User } from '../models';

const user: User = { id: 'u1', name: 'Analista 1', role: 'analyst' };

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** El entorno de pruebas no trae Web Storage: se sustituye por uno en memoria. */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value)
  } as Storage;
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('sessionStorage', createMemoryStorage());

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('empieza sin sesión', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('guarda la sesión en localStorage cuando se pide recordarla', () => {
    service.setSession('token-1', user, inMinutes(60), true);

    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('rtattooai_token')).toBe('token-1');
    expect(sessionStorage.getItem('rtattooai_token')).toBeNull();
  });

  it('usa sessionStorage cuando no se pide recordarla, para no dejar rastro en el equipo', () => {
    service.setSession('token-1', user, inMinutes(60), false);

    expect(sessionStorage.getItem('rtattooai_token')).toBe('token-1');
    expect(localStorage.getItem('rtattooai_token')).toBeNull();
  });

  it('considera no autenticada una sesión ya caducada', () => {
    service.setSession('token-1', user, inMinutes(-1), true);

    expect(service.isExpired()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('aplica un margen antes de la caducidad real', () => {
    // Caduca dentro de 10 s: por debajo del margen de 30 s, se trata como caducada.
    service.setSession('token-1', user, new Date(Date.now() + 10_000).toISOString(), true);

    expect(service.isExpired()).toBe(true);
    expect(service.millisecondsUntilExpiry()).toBe(0);
  });

  it('limpia ambos almacenamientos al cerrar sesión', () => {
    service.setSession('token-1', user, inMinutes(60), true);
    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('rtattooai_token')).toBeNull();
    expect(sessionStorage.getItem('rtattooai_token')).toBeNull();
  });

  it('reconoce los roles con permiso de supervisión', () => {
    service.setSession('t', { ...user, role: 'analyst' }, inMinutes(60), true);
    expect(service.canSupervise()).toBe(false);

    service.setSession('t', { ...user, role: 'supervisor' }, inMinutes(60), true);
    expect(service.canSupervise()).toBe(true);

    service.setSession('t', { ...user, role: 'admin' }, inMinutes(60), true);
    expect(service.canSupervise()).toBe(true);
  });
});
