import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditFilters, AuditService } from '../../../core/api';
import { AuditEntry } from '../../../core/models';
import { parseApiDate } from '../../../core/utils/parse-api-date';
import { downloadBlob } from '../../../core/utils/download-blob';
import { Icon } from '../../../shared/ui';

interface AuditRow {
  item: AuditEntry;
  date: Date;
  badge: string;
}

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 50;

/** Registro de auditoría (HU0014): quién hizo qué, cuándo y con qué resultado. */
@Component({
  selector: 'app-admin-audit',
  imports: [DatePipe, Icon],
  templateUrl: './audit.html'
})
export class AdminAudit implements OnInit, OnDestroy {
  private readonly auditService = inject(AuditService);

  readonly items = signal<AuditEntry[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly action = signal('');
  readonly userEmail = signal('');
  readonly from = signal('');
  readonly to = signal('');

  readonly isExporting = signal(false);
  readonly exportError = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasFilters = computed(
    () => this.action().trim() !== '' || this.userEmail().trim() !== '' || this.from() !== '' || this.to() !== ''
  );

  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1));
  readonly rangeEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

  readonly rows = computed<AuditRow[]>(() =>
    this.items().map((item) => ({
      item,
      date: parseApiDate(item.occurredAt),
      badge: badgeFor(item.statusCode)
    }))
  );

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  onActionInput(event: Event): void {
    this.action.set((event.target as HTMLInputElement).value);
    this.debouncedReload();
  }

  onUserEmailInput(event: Event): void {
    this.userEmail.set((event.target as HTMLInputElement).value);
    this.debouncedReload();
  }

  onFromChange(event: Event): void {
    this.from.set((event.target as HTMLInputElement).value);
    this.reload();
  }

  onToChange(event: Event): void {
    this.to.set((event.target as HTMLInputElement).value);
    this.reload();
  }

  clearFilters(): void {
    this.action.set('');
    this.userEmail.set('');
    this.from.set('');
    this.to.set('');
    this.reload();
  }

  goToPage(page: number): void {
    if (page < 1 || (this.totalPages() > 0 && page > this.totalPages()) || this.isLoading()) {
      return;
    }

    this.page.set(page);
    this.load();
  }

  reload(): void {
    this.page.set(1);
    this.load();
  }

  /** Exporta el registro filtrado, para adjuntarlo al expediente de validación (RF-17). */
  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);
    this.exportError.set(null);

    this.auditService.exportCsv(this.filters()).subscribe({
      next: (blob) => {
        this.isExporting.set(false);
        downloadBlob(blob, 'rtattooai-auditoria');
      },
      error: () => {
        this.isExporting.set(false);
        this.exportError.set('No se pudo generar la exportación.');
      }
    });
  }

  private debouncedReload(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.reload(), SEARCH_DEBOUNCE_MS);
  }

  private filters(): AuditFilters {
    return {
      action: this.action().trim() || undefined,
      userEmail: this.userEmail().trim() || undefined,
      from: this.from() || undefined,
      to: this.to() || undefined
    };
  }

  private load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.auditService.list(this.filters(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.totalPages.set(result.totalPages);
        this.page.set(result.page);
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
