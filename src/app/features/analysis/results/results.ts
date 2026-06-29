import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AnalysisService } from '../../../core/api';
import { Analysis, Detection, Match, ValidationStatus } from '../../../core/models';
import { BboxOverlay, ConfidenceSemaforo, DisclaimerBanner } from '../../../shared/components';
import { Icon, TattooThumb, ConfidenceBand, confidenceBand, detectionColor } from '../../../shared/ui';
import { buildAnalysisPdf } from './pdf-report';

interface MatchVm {
  match: Match;
  rank: number;
  pct: number;
  band: ConfidenceBand;
}

interface DetectionChip {
  id: string;
  index: number;
  pct: number;
  color: string;
  verdict: Detection['verdict'];
}

/** Coincide con el umbral de "Alta" confianza usado en confidence.ts. */
const ENROLL_DEFAULT_THRESHOLD_PCT = 80;

interface ConfidenceSummary {
  alta: number;
  media: number;
  baja: number;
}

@Component({
  selector: 'app-results',
  imports: [DecimalPipe, RouterLink, Icon, TattooThumb, BboxOverlay, ConfidenceSemaforo, DisclaimerBanner],
  templateUrl: './results.html'
})
export class Results {
  private readonly route = inject(ActivatedRoute);
  private readonly analysisService = inject(AnalysisService);

  readonly analysis = signal<Analysis | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeDetection = signal(0);
  readonly activeMatch = signal(0);

  readonly selectedDetectionIds = signal<Set<string>>(new Set());
  readonly enrolledDetectionIds = signal<Set<string>>(new Set());
  readonly isEnrolling = signal(false);
  readonly enrollError = signal<string | null>(null);
  readonly enrollSuccess = signal<string | null>(null);

  readonly validationNotesDraft = signal('');
  readonly isValidating = signal(false);
  readonly validationError = signal<string | null>(null);

  readonly isExportingPdf = signal(false);
  readonly pdfExportError = signal<string | null>(null);

  readonly detections = computed<Detection[]>(() => this.analysis()?.detections ?? []);
  readonly detectionCount = computed(() => this.detections().length);
  readonly totalMatches = computed(() => this.detections().reduce((acc, d) => acc + d.matches.length, 0));

  readonly activeDet = computed<Detection | null>(() => this.detections()[this.activeDetection()] ?? null);
  readonly bestSimilarity = computed<number | null>(() => this.activeDet()?.matches[0]?.similarity ?? null);

  readonly detectionChips = computed<DetectionChip[]>(() =>
    this.detections().map((detection, index) => {
      const pct = Math.round(detection.confidence * 100);
      return { id: detection.id, index, pct, color: detectionColor(pct), verdict: detection.verdict };
    })
  );

  readonly selectedCount = computed(() => this.selectedDetectionIds().size);

  readonly matchVms = computed<MatchVm[]>(() =>
    (this.activeDet()?.matches ?? []).slice(0, 5).map((match, index) => {
      const pct = Math.round(match.similarity * 100);
      return { match, rank: index + 1, pct, band: confidenceBand(pct) };
    })
  );

  readonly summary = computed<ConfidenceSummary>(() => {
    const counts: ConfidenceSummary = { alta: 0, media: 0, baja: 0 };
    for (const vm of this.matchVms()) {
      if (vm.pct >= 80) {
        counts.alta++;
      } else if (vm.pct >= 60) {
        counts.media++;
      } else {
        counts.baja++;
      }
    }
    return counts;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.load(id);
      }
    });
  }

  reload(id: string): void {
    this.load(id);
  }

  selectDetection(index: number): void {
    this.activeDetection.set(index);
    this.activeMatch.set(0);
    this.validationNotesDraft.set(this.detections()[index]?.validationNotes ?? '');
    this.validationError.set(null);
  }

  onValidationNotesInput(event: Event): void {
    this.validationNotesDraft.set((event.target as HTMLTextAreaElement).value);
  }

  submitValidation(status: Exclude<ValidationStatus, 'pending'>): void {
    const item = this.analysis();
    const det = this.activeDet();
    if (!item || !det || this.isValidating()) {
      return;
    }

    this.isValidating.set(true);
    this.validationError.set(null);

    this.analysisService.validateDetection(item.id, det.id, status, this.validationNotesDraft().trim() || null).subscribe({
      next: (updated) => {
        this.isValidating.set(false);
        this.analysis.set({
          ...item,
          detections: item.detections.map((d) => (d.id === updated.id ? updated : d))
        });
        this.validationNotesDraft.set(updated.validationNotes ?? '');
      },
      error: (err) => {
        this.isValidating.set(false);
        this.validationError.set(err.error?.error ?? 'No se pudo registrar la validación. Intenta de nuevo.');
      }
    });
  }

  selectMatch(index: number): void {
    this.activeMatch.set(index);
  }

  isSelectedForEnroll(detectionId: string): boolean {
    return this.selectedDetectionIds().has(detectionId);
  }

  isEnrolled(detectionId: string): boolean {
    return this.enrolledDetectionIds().has(detectionId);
  }

  toggleEnroll(detectionId: string): void {
    if (this.isEnrolled(detectionId)) {
      return;
    }

    const next = new Set(this.selectedDetectionIds());
    if (next.has(detectionId)) {
      next.delete(detectionId);
    } else {
      next.add(detectionId);
    }
    this.selectedDetectionIds.set(next);
  }

  enrollSelected(): void {
    const item = this.analysis();
    const detectionIds = [...this.selectedDetectionIds()];
    if (!item || detectionIds.length === 0 || this.isEnrolling()) {
      return;
    }

    this.isEnrolling.set(true);
    this.enrollError.set(null);
    this.enrollSuccess.set(null);

    this.analysisService.enrollDetections(item.id, detectionIds).subscribe({
      next: (catalogItems) => {
        this.isEnrolling.set(false);
        this.enrolledDetectionIds.set(new Set([...this.enrolledDetectionIds(), ...detectionIds]));
        this.selectedDetectionIds.set(new Set());
        this.enrollSuccess.set(
          `${catalogItems.length} ${catalogItems.length === 1 ? 'tatuaje agregado' : 'tatuajes agregados'} al catálogo, sin banda asignada.`
        );
      },
      error: (err) => {
        this.isEnrolling.set(false);
        this.enrollError.set(err.error?.error ?? 'No se pudo agregar al catálogo. Intenta de nuevo.');
      }
    });
  }

  async exportPdf(): Promise<void> {
    const item = this.analysis();
    if (!item || this.isExportingPdf()) {
      return;
    }

    this.isExportingPdf.set(true);
    this.pdfExportError.set(null);

    try {
      const doc = await buildAnalysisPdf(item);
      doc.save(`rtattooai-reporte-${item.id}.pdf`);
    } catch {
      this.pdfExportError.set('No se pudo generar el reporte PDF. Intenta de nuevo.');
    } finally {
      this.isExportingPdf.set(false);
    }
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.analysisService.getById(id).subscribe({
      next: (analysis) => {
        this.analysis.set(analysis);
        this.activeDetection.set(0);
        this.activeMatch.set(0);
        this.validationNotesDraft.set(analysis.detections[0]?.validationNotes ?? '');
        this.validationError.set(null);
        this.selectedDetectionIds.set(
          new Set(
            analysis.detections
              .filter((d) => Math.round(d.confidence * 100) >= ENROLL_DEFAULT_THRESHOLD_PCT)
              .map((d) => d.id)
          )
        );
        this.enrolledDetectionIds.set(new Set());
        this.enrollError.set(null);
        this.enrollSuccess.set(null);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el análisis.');
      }
    });
  }
}
