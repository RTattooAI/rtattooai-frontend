import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AnalysisService } from '../../core/api';
import { AuthService } from '../../core/auth';
import { AnalysisListItem, AnalysisStatus } from '../../core/models';
import { parseApiDate } from '../../core/utils/parse-api-date';
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
export class History implements OnInit {
  private readonly analysisService = inject(AnalysisService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Supervisor y admin pueden ver el historial de todos los analistas. */
  readonly canSupervise = this.authService.canSupervise();
  readonly scope = signal<'mine' | 'all'>('mine');

  readonly items = signal<AnalysisListItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly search = signal('');
  readonly statusFilter = signal<AnalysisStatus | 'all'>('all');

  // Sin "Procesando": el analisis se resuelve dentro de la misma peticion, de modo
  // que ese estado nunca llega a listarse y el filtro siempre saldria vacio.
  readonly statusOptions: { value: AnalysisStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'completed', label: 'Completado' },
    { value: 'no_detection', label: 'Sin detección' },
    { value: 'failed', label: 'Falló' }
  ];

  readonly rows = computed<HistoryRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items()
      .filter((item) => status === 'all' || item.status === status)
      .filter(
        (item) =>
          term === '' ||
          item.id.toLowerCase().includes(term) ||
          (item.topBand ?? '').toLowerCase().includes(term) ||
          (item.personName ?? '').toLowerCase().includes(term) ||
          (item.documentId ?? '').toLowerCase().includes(term)
      )
      .map((item) => {
        const pct = item.topSimilarity != null ? Math.round(item.topSimilarity * 100) : null;
        return {
          item,
          date: parseApiDate(item.createdAt),
          status: STATUS_META[item.status],
          similarityPct: pct,
          band: pct != null ? confidenceBand(pct) : null
        };
      });
  });

  ngOnInit(): void {
    this.load();
  }

  toggleScope(): void {
    this.scope.set(this.scope() === 'mine' ? 'all' : 'mine');
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.analysisService.list(this.scope()).subscribe({
      next: (items) => {
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el historial.');
      }
    });
  }

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AnalysisStatus | 'all');
  }

  openAnalysis(id: string): void {
    this.router.navigate(['/results', id]);
  }
}
