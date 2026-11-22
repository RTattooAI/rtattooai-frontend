import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalysisService, DashboardService } from '../../../core/api';
import { DashboardMetrics } from '../../../core/models';
import { Icon } from '../../../shared/ui';
import { downloadBlob } from '../../../core/utils/download-blob';

interface StatusBarVm {
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface TrendBarVm {
  date: string;
  count: number;
  heightPct: number;
}

const STATUS_COLORS: Record<string, string> = {
  completado: '#10B981',
  procesando: '#F59E0B',
  'sin detección': '#94A3B8',
  fallido: '#EF4444'
};

const VALIDATION_COLORS: Record<string, string> = {
  pendiente: '#94A3B8',
  validada: '#10B981',
  'en revisión': '#F59E0B',
  descartada: '#EF4444'
};

@Component({
  selector: 'app-admin-dashboard',
  imports: [DecimalPipe, Icon],
  templateUrl: './dashboard.html'
})
export class AdminDashboard implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly analysisService = inject(AnalysisService);

  readonly isExporting = signal(false);
  readonly isExportingMetrics = signal(false);
  readonly exportError = signal<string | null>(null);

  readonly metrics = signal<DashboardMetrics | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly statusBars = computed<StatusBarVm[]>(() => {
    const m = this.metrics();
    if (!m) {
      return [];
    }
    const entries: [string, number][] = [
      ['Completado', m.analysesByStatus.completed],
      ['Procesando', m.analysesByStatus.processing],
      ['Sin detección', m.analysesByStatus.noDetection],
      ['Fallido', m.analysesByStatus.failed]
    ];
    const total = Math.max(m.totalAnalyses, 1);
    return entries.map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      color: STATUS_COLORS[label.toLowerCase()] ?? '#94A3B8'
    }));
  });

  readonly validationBars = computed<StatusBarVm[]>(() => {
    const m = this.metrics();
    if (!m) {
      return [];
    }
    const entries: [string, number][] = [
      ['Pendiente', m.detectionsByValidation.pending],
      ['Validada', m.detectionsByValidation.validated],
      ['En revisión', m.detectionsByValidation.review],
      ['Descartada', m.detectionsByValidation.dismissed]
    ];
    const total = Math.max(entries.reduce((acc, [, c]) => acc + c, 0), 1);
    return entries.map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      color: VALIDATION_COLORS[label.toLowerCase()] ?? '#94A3B8'
    }));
  });

  readonly trendBars = computed<TrendBarVm[]>(() => {
    const days = this.metrics()?.analysesLast30Days ?? [];
    const max = Math.max(...days.map((d) => d.count), 1);
    return days.map((d) => ({
      date: d.date,
      count: d.count,
      heightPct: Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 6 : 2)
    }));
  });

  readonly maxTopBandCount = computed(() => Math.max(...(this.metrics()?.topBands.map((b) => b.count) ?? [0]), 1));

  /**
   * Descarga una fila por deteccion (veredicto del sistema frente a decision del
   * perito): es la fuente de las tablas de resultados de la validacion.
   */
  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);
    this.exportError.set(null);

    this.analysisService.exportCsv('all').subscribe({
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

  /** Los totales del propio panel, para el anexo de resultados (RF-17). */
  exportMetrics(): void {
    if (this.isExportingMetrics()) {
      return;
    }

    this.isExportingMetrics.set(true);
    this.exportError.set(null);

    this.dashboardService.exportCsv().subscribe({
      next: (blob) => {
        this.isExportingMetrics.set(false);
        downloadBlob(blob, 'rtattooai-metricas');
      },
      error: () => {
        this.isExportingMetrics.set(false);
        this.exportError.set('No se pudieron exportar las métricas.');
      }
    });
  }

  ngOnInit(): void {
    this.dashboardService.getMetrics().subscribe({
      next: (metrics) => {
        this.metrics.set(metrics);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set('No se pudo cargar el panel de métricas.');
      }
    });
  }
}
