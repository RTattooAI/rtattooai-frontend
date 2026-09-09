import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../../core/auth';
import { Icon, LogoMark } from '../../ui';

interface NavLink {
  link: string;
  icon: string;
  label: string;
  roles?: string[];
}

interface ScreenMeta {
  title: string;
  breadcrumb: string[];
}

const BASE_NAV =
  'relative w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors text-left';
const ACTIVE_NAV = 'nav-active bg-white/10 text-white font-medium';
const INACTIVE_NAV = 'text-navy-200 hover:bg-white/5 hover:text-white';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, LogoMark],
  templateUrl: './shell.html'
})
export class Shell {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authService.currentUser;

  readonly operacionNav: NavLink[] = [
    { link: '/upload', icon: 'scan-search', label: 'Nuevo análisis' },
    { link: '/history', icon: 'history', label: 'Historial de consultas' },
    { link: '/catalog/enroll', icon: 'book-marked', label: 'Catálogo de tatuajes' }
  ];

  private readonly allGestionNav: NavLink[] = [
    { link: '/catalog/bands', icon: 'tags', label: 'Bandas criminales', roles: ['admin', 'supervisor'] },
    { link: '/reviews', icon: 'clipboard-check', label: 'Bandeja de revisión', roles: ['admin', 'supervisor'] },
    { link: '/admin/dashboard', icon: 'layout-grid', label: 'Panel de control', roles: ['admin', 'supervisor'] },
    { link: '/admin/models', icon: 'cpu', label: 'Modelos', roles: ['admin', 'supervisor'] },
    { link: '/admin/users', icon: 'users', label: 'Usuarios', roles: ['admin'] },
    { link: '/admin/audit', icon: 'shield-check', label: 'Auditoría', roles: ['admin'] }
  ];

  readonly gestionNav = computed<NavLink[]>(() => {
    const role = this.currentUser()?.role;
    return this.allGestionNav.filter((item) => !item.roles || (role && item.roles.includes(role)));
  });

  readonly navOpen = signal(false);

  readonly today = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  readonly initials = computed(() => {
    const name = this.currentUser()?.name ?? '';
    return (
      name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'PN'
    );
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly meta = computed<ScreenMeta>(() => metaForUrl(this.currentUrl()));

  constructor() {
    this.scheduleSessionExpiry();
  }

  /**
   * Cierra la sesion cuando caduca el token, sin esperar a que una peticion falle:
   * en un equipo compartido la pantalla no debe seguir aparentando sesion activa.
   */
  private scheduleSessionExpiry(): void {
    const remaining = this.authService.millisecondsUntilExpiry();
    if (remaining <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      this.authService.logout();
      this.router.navigate(['/login'], { queryParams: { expired: 1 } });
    }, remaining);

    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  navClass(active: boolean): string {
    return `${BASE_NAV} ${active ? ACTIVE_NAV : INACTIVE_NAV}`;
  }

  openNav(): void {
    this.navOpen.set(true);
  }

  closeNav(): void {
    this.navOpen.set(false);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

function metaForUrl(url: string): ScreenMeta {
  if (url.startsWith('/results')) {
    return { title: 'Resultados del análisis', breadcrumb: ['Inicio', 'Análisis', 'Resultados'] };
  }
  if (url.startsWith('/history')) {
    return { title: 'Historial de consultas', breadcrumb: ['Inicio', 'Historial'] };
  }
  if (url.startsWith('/catalog')) {
    return { title: 'Catálogo de tatuajes', breadcrumb: ['Inicio', 'Gestión', 'Catálogo'] };
  }
  if (url.startsWith('/admin/users')) {
    return { title: 'Usuarios', breadcrumb: ['Inicio', 'Gestión', 'Usuarios'] };
  }
  if (url.startsWith('/admin/dashboard')) {
    return { title: 'Panel de control', breadcrumb: ['Inicio', 'Gestión', 'Panel'] };
  }
  if (url.startsWith('/admin/audit')) {
    return { title: 'Registro de auditoría', breadcrumb: ['Inicio', 'Gestión', 'Auditoría'] };
  }
  if (url.startsWith('/reviews')) {
    return { title: 'Bandeja de revisión', breadcrumb: ['Inicio', 'Gestión', 'Revisión'] };
  }
  return { title: 'Nuevo análisis', breadcrumb: ['Inicio', 'Análisis', 'Nuevo'] };
}
