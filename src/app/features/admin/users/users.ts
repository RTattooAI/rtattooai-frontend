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

  // Form modal state
  readonly showForm = signal(false);
  readonly fullName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly role = signal<UserRole>('analyst');
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);

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
    this.fullName.set('');
    this.email.set('');
    this.password.set('');
    this.role.set('analyst');
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

  onSubmit(): void {
    const fullName = this.fullName().trim();
    const email = this.email().trim();
    const password = this.password();
    if (!fullName || !email || password.length < 8 || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set(null);

    this.usersService.create(fullName, email, password, this.role()).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.showForm.set(false);
        this.items.set([...this.items(), created]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.formError.set(err.error?.error ?? 'No se pudo crear el usuario. Intenta de nuevo.');
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
