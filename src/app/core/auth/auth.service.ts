import { Injectable, computed, signal } from '@angular/core';
import { User } from '../models';

const TOKEN_KEY = 'rtattooai_token';
const USER_KEY = 'rtattooai_user';
const EXPIRES_KEY = 'rtattooai_expires';

/**
 * Margen antes de la caducidad real del token: evita que una petición salga con un
 * token que va a expirar mientras viaja.
 */
const EXPIRY_SKEW_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSignal = signal<string | null>(readStored(TOKEN_KEY));
  private readonly userSignal = signal<User | null>(readStoredUser());
  private readonly expiresAtSignal = signal<number | null>(readStoredExpiry());

  readonly token = this.tokenSignal.asReadonly();
  readonly currentUser = this.userSignal.asReadonly();
  readonly expiresAt = this.expiresAtSignal.asReadonly();

  /** Una sesión caducada equivale a no tener sesión, sin esperar a que el backend responda 401. */
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null && !this.isExpired());

  constructor() {
    if (this.tokenSignal() !== null && this.isExpired()) {
      this.logout();
    }
  }

  /**
   * @param remember `true` guarda la sesión en localStorage (sobrevive al cierre del
   * navegador); `false` usa sessionStorage y la sesión muere con la pestaña, que es
   * lo esperable en un equipo compartido.
   */
  setSession(token: string, user: User, expiresAt: string, remember = true): void {
    clearStorage();

    const store = remember ? localStorage : sessionStorage;
    const expiryMs = Date.parse(expiresAt);

    try {
      store.setItem(TOKEN_KEY, token);
      store.setItem(USER_KEY, JSON.stringify(user));
      if (!Number.isNaN(expiryMs)) {
        store.setItem(EXPIRES_KEY, String(expiryMs));
      }
    } catch {
      // Almacenamiento no disponible (modo privado restringido): la sesión sigue
      // viva en memoria durante esta carga de la aplicación.
    }

    this.tokenSignal.set(token);
    this.userSignal.set(user);
    this.expiresAtSignal.set(Number.isNaN(expiryMs) ? null : expiryMs);
  }

  logout(): void {
    clearStorage();
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.expiresAtSignal.set(null);
  }

  isExpired(): boolean {
    const expiry = this.expiresAtSignal();
    return expiry !== null && Date.now() >= expiry - EXPIRY_SKEW_MS;
  }

  /** Milisegundos que faltan para la caducidad; 0 si ya caducó o se desconoce. */
  millisecondsUntilExpiry(): number {
    const expiry = this.expiresAtSignal();
    if (expiry === null) {
      return 0;
    }
    return Math.max(expiry - EXPIRY_SKEW_MS - Date.now(), 0);
  }

  hasRole(...roles: string[]): boolean {
    const role = this.userSignal()?.role;
    return role !== undefined && roles.includes(role);
  }

  canSupervise(): boolean {
    return this.hasRole('supervisor', 'admin');
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredUser(): User | null {
  const raw = readStored(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function readStoredExpiry(): number | null {
  const raw = readStored(EXPIRES_KEY);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function clearStorage(): void {
  for (const store of [localStorage, sessionStorage]) {
    try {
      store.removeItem(TOKEN_KEY);
      store.removeItem(USER_KEY);
      store.removeItem(EXPIRES_KEY);
    } catch {
      // Sin almacenamiento disponible no hay nada que limpiar.
    }
  }
}
