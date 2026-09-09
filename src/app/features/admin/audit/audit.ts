import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditService } from '../../../core/api';
import { AuditEntry } from '../../../core/models';
import { parseApiDate } from '../../../core/utils/parse-api-date';
import { Icon } from '../../../shared/ui';

interface AuditRow {
  item: AuditEntry;
  date: Date;
  badge: string;
}

/** Registro de auditoría (HU0014): quién hizo qué, cuándo y con qué resultado. */
@Component({
  selector: 'app-admin-audit',
  imports: [DatePipe, Icon],
  templateUrl: './audit.html'
})
export class AdminAudit implements OnInit {
  private readonly auditService = inject(AuditService);

  readonly items = signal<AuditEntry[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly search = signal('');

  readonly rows = computed<AuditRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    return this.items()
      .filter(
        (item) =>
          term === '' ||
          item.action.toLowerCase().includes(term) ||
          (item.userEmail ?? '').toLowerCase().includes(term) ||
          (item.ipAddress ?? '').toLowerCase().includes(term) ||
          (item.resource ?? '').toLowerCase().includes(term)
      )
      .map((item) => ({
        item,
        date: parseApiDate(item.occurredAt),
        badge: badgeFor(item.statusCode)
      }));
  });

  ngOnInit(): void {
    this.load();
  }

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  reload(): void {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.auditService.recent(200).subscribe({
      next: (items) => {
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el registro de auditoría.');
      }
    });
  }
}

function badgeFor(statusCode: number): string {
  if (statusCode >= 500) {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  if (statusCode >= 400) {
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
}
