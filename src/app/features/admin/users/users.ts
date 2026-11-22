import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { UsersService } from '../../../core/api';
import { UserListItem, UserRole } from '../../../core/models';
import { Icon } from '../../../shared/ui';
import { parseApiDate } from '../../../core/utils/parse-api-date';

const ROLE_LABELS: Record<UserRole, string> = {
  analyst: 'Analista',
  supervisor: 'Supervisor',
  admin: 'Administrador'
};

const ROLE_BADGES: Record<UserRole, string> = {
  analyst: 'bg-slate-100 text-slate-700 ring-slate-200',
  supervisor: 'bg-amber-50 text-amber-700 ring-amber-200',
  admin: 'bg-navy-100 text-navy-800 ring-navy-200'
};

interface UserRow {
  item: UserListItem;
  date: Date;
}

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, Icon],
  templateUrl: './users.html'
})
export class AdminUsers implements OnInit {
  private readonly usersService = inject(UsersService);

  readonly roleLabels = ROLE_LABELS;
  readonly roleBadges = ROLE_BADGES;

  readonly items = signal<UserListItem[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly rows = computed<UserRow[]>(() =>
    this.items().map((item) => ({ item, date: parseApiDate(item.createdAt) }))
  );

  // Un mismo formulario sirve para el alta y para la edicion: en edicion no se pide
  // correo ni contrasena, que tienen su propio flujo.
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly fullName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly role = signal<UserRole>('analyst');
  readonly dependency = signal('');
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly canSubmit = computed(() => {
    if (!this.fullName().trim() || this.isSubmitting()) {
      return false;
    }
    // En edicion no se toca ni el correo ni la contrasena.
    return this.editingId() !== null || (this.email().trim() !== '' && this.password().length >= 8);
  });

  readonly togglingId = signal<string | null>(null);

  // Restablecimiento de contrasena: sustituye al "olvide mi contrasena" que antes
  // era un enlace sin funcion en la pantalla de acceso.
  readonly resetTargetId = signal<string | null>(null);
  readonly resetPassword = signal('');
  readonly isResetting = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly resetSuccess = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  openForm(): void {
    this.editingId.set(null);
    this.fullName.set('');
    this.email.set('');
    this.password.set('');
    this.role.set('analyst');
    this.dependency.set('');
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(user: UserListItem): void {
    this.editingId.set(user.id);
    this.fullName.set(user.fullName);
    this.email.set(user.email);
    this.password.set('');
    this.role.set(user.role);
    this.dependency.set(user.dependency ?? '');
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onFullNameInput(event: Event): void {
    this.fullName.set((event.target as HTMLInputElement).value);
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  onRoleChange(event: Event): void {
    this.role.set((event.target as HTMLSelectElement).value as UserRole);
  }

  onDependencyInput(event: Event): void {
    this.dependency.set((event.target as HTMLInputElement).value);
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      return;
    }

    const fullName = this.fullName().trim();
    const dependency = this.dependency().trim() || null;
    const editingId = this.editingId();

    this.isSubmitting.set(true);
    this.formError.set(null);

    const request$ = editingId
      ? this.usersService.update(editingId, fullName, this.role(), dependency)
      : this.usersService.create(fullName, this.email().trim(), this.password(), this.role(), dependency);

    request$.subscribe({
      next: (saved) => {
        this.isSubmitting.set(false);
        this.showForm.set(false);
        this.items.set(
          editingId
            ? this.items().map((item) => (item.id === saved.id ? saved : item))
            : [...this.items(), saved]
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.formError.set(
          err.error?.error ?? (editingId ? 'No se pudo guardar el usuario.' : 'No se pudo crear el usuario. Intenta de nuevo.')
        );
      }
    });
  }

  openReset(user: UserListItem): void {
    this.resetTargetId.set(user.id);
    this.resetPassword.set('');
    this.resetError.set(null);
    this.resetSuccess.set(null);
  }

  closeReset(): void {
    this.resetTargetId.set(null);
  }

  onResetPasswordInput(event: Event): void {
    this.resetPassword.set((event.target as HTMLInputElement).value);
  }

  submitReset(): void {
    const id = this.resetTargetId();
    const password = this.resetPassword();
    if (!id || password.length < 8 || this.isResetting()) {
      return;
    }

    this.isResetting.set(true);
    this.resetError.set(null);

    this.usersService.resetPassword(id, password).subscribe({
      next: (updated) => {
        this.isResetting.set(false);
        this.resetTargetId.set(null);
        this.resetSuccess.set(`Contraseña restablecida para ${updated.email}.`);
      },
      error: (err) => {
        this.isResetting.set(false);
        this.resetError.set(err.error?.error ?? 'No se pudo restablecer la contraseña.');
      }
    });
  }

  isToggling(id: string): boolean {
    return this.togglingId() === id;
  }

  toggleActive(user: UserListItem): void {
    if (this.togglingId()) {
      return;
    }

    this.togglingId.set(user.id);
    this.usersService.setActive(user.id, !user.active).subscribe({
      next: (updated) => {
        this.togglingId.set(null);
        this.items.set(this.items().map((item) => (item.id === updated.id ? updated : item)));
      },
      error: () => {
        this.togglingId.set(null);
      }
    });
  }

  private load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.usersService.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set('No se pudo cargar la lista de usuarios.');
      }
    });
  }
}
