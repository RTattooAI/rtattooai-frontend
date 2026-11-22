import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AnalysisService, HistoryFilters } from '../../core/api';
import { AuthService } from '../../core/auth';
import { AnalysisListItem, AnalysisStatus } from '../../core/models';
import { parseApiDate } from '../../core/utils/parse-api-date';
import { downloadBlob } from '../../core/utils/download-blob';
import { Icon, TattooThumb, ConfidenceBand, confidenceBand } from '../../shared/ui';

interface StatusMeta {
  label: string;
  badge: string;
}

const STATUS_META: Record<AnalysisStatus, StatusMeta> = {
  completed: { label: 'Completado', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  processing: { label: 'Procesando', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  no_detection: { label: 'Sin detección', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  failed: { label: 'Falló', badge: 'bg-rose-50 text-rose-700 ring-rose-200' }
};

/** Espera antes de consultar mientras se escribe: una petición por pulsación sería absurda. */
const SEARCH_DEBOUNCE_MS = 350;

const PAGE_SIZE = 25;

interface HistoryRow {
  item: AnalysisListItem;
  date: Date;
  status: StatusMeta;
  similarityPct: number | null;
  band: ConfidenceBand | null;
}

@Component({
  selector: 'app-history',
  imports: [DatePipe, Icon, TattooThumb],
  templateUrl: './history.html'
})
export class History implements OnInit, OnDestroy {
  private readonly analysisService = inject(AnalysisService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Supervisor y admin pueden ver el historial de todos los analistas. */
  readonly canSupervise = this.authService.canSupervise();
  readonly scope = signal<'mine' | 'all'>('mine');

  readonly items = signal<AnalysisListItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly search = signal('');
  readonly statusFilter = signal<AnalysisStatus | 'all'>('all');
  readonly from = signal('');
  readonly to = signal('');

  readonly isExporting = signal(false);
  readonly exportError = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Sin "Procesando": el analisis se resuelve dentro de la misma peticion, de modo
  // que ese estado nunca llega a listarse y el filtro siempre saldria vacio.
  readonly statusOptions: { value: AnalysisStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'completed', label: 'Completado' },
    { value: 'no_detection', label: 'Sin detección' },
    { value: 'failed', label: 'Falló' }
  ];

  readonly hasFilters = computed(
    () => this.search().trim() !== '' || this.statusFilter() !== 'all' || this.from() !== '' || this.to() !== ''
  );

  /** El rango mostrado, para que el usuario sepa qué parte del total está viendo. */
  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1));
  readonly rangeEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

  readonly rows = computed<HistoryRow[]>(() =>
    this.items().map((item) => {
      const pct = item.topSimilarity != null ? Math.round(item.topSimilarity * 100) : null;
      return {
        item,
        date: parseApiDate(item.createdAt),
        status: STATUS_META[item.status],
        similarityPct: pct,
        band: pct != null ? confidenceBand(pct) : null
      };
    })
  );

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  toggleScope(): void {
    this.scope.set(this.scope() === 'mine' ? 'all' : 'mine');
    this.reload();
  }

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.reload(), SEARCH_DEBOUNCE_MS);
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AnalysisStatus | 'all');
    this.reload();
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
    this.search.set('');
    this.statusFilter.set('all');
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

  /** Descarga el historial filtrado tal como se está viendo (RF-17). */
  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);
    this.exportError.set(null);

    this.analysisService.exportCsv(this.scope(), this.filters()).subscribe({
      next: (blob) => {
        this.isExporting.set(false);
        downloadBlob(blob, 'rtattooai-validacion');
      },
      error: () => {
        this.isExporting.set(false);
        this.exportError.set('No se pudo generar la exportación.');
      }
    });
  }

  openAnalysis(id: string): void {
    this.router.navigate(['/results', id]);
  }

  /** Cambiar un filtro invalida la página actual: se vuelve a la primera. */
  private reload(): void {
    this.page.set(1);
    this.load();
  }

  private filters(): HistoryFilters {
    return {
      q: this.search().trim() || undefined,
      status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
      from: this.from() || undefined,
      to: this.to() || undefined
    };
  }

  private load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.analysisService.list(this.scope(), this.filters(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.totalPages.set(result.totalPages);
        this.page.set(result.page);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el historial.');
      }
    });
  }
}
