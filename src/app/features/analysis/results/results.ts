import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AnalysisService } from '../../../core/api';
import { Analysis, AnalysisImage, Detection, Match, ValidationStatus } from '../../../core/models';
import { BboxOverlay, ConfidenceSemaforo, DisclaimerBanner, TattooCompare } from '../../../shared/components';
import {
  Icon,
  TattooThumb,
  ConfidenceBand,
  confidenceBand,
  detectionColor,
  DETECTION_HIGH,
  SIMILARITY_STRONG,
  SIMILARITY_THRESHOLD
} from '../../../shared/ui';
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
  matchType: Detection['matchType'];
}

/**
 * Preseleccion para enrolar: se mide la confianza del DETECTOR (¿el recorte es un
 * tatuaje nitido?), no la similitud con el catalogo. Por eso usa DETECTION_HIGH y no
 * el corte de similitud del semaforo.
 */
const ENROLL_DEFAULT_THRESHOLD_PCT = DETECTION_HIGH;

interface ConfidenceSummary {
  alta: number;
  media: number;
  baja: number;
}

/**
 * Cómo se presenta cada clase de coincidencia. El caso que importa distinguir es
 * `unclassified`: el sistema ya vio ese tatuaje, pero eso no es una pertenencia a
 * una banda y no puede presentarse con el mismo lenguaje.
 */
const MATCH_TYPE_META: Record<Detection['matchType'], { label: string; badge: string } | null> = {
  band: { label: 'Coincidencia', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  unclassified: { label: 'Ya visto · sin clasificar', badge: 'bg-sky-50 text-sky-700 ring-sky-200' },
  review: { label: 'Posible; requiere revisión', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  none: { label: 'Sin coincidencia concluyente', badge: 'bg-slate-100 text-slate-600 ring-slate-200' }
};

@Component({
  selector: 'app-results',
  imports: [DecimalPipe, RouterLink, Icon, TattooThumb, BboxOverlay, ConfidenceSemaforo, DisclaimerBanner, TattooCompare],
  templateUrl: './results.html'
})
export class Results {
  private readonly route = inject(ActivatedRoute);
  private readonly analysisService = inject(AnalysisService);

  readonly analysis = signal<Analysis | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  /** Imagen del análisis que se está viendo; las detecciones se filtran por ella. */
  readonly activeImageIndex = signal(0);
  readonly activeDetection = signal(0);
  readonly activeMatch = signal(0);

  readonly selectedDetectionIds = signal<Set<string>>(new Set());
  readonly matchTypeMeta = MATCH_TYPE_META;

  readonly enrolledDetectionIds = signal<Set<string>>(new Set());
  readonly isEnrolling = signal(false);
  readonly enrollError = signal<string | null>(null);
  readonly enrollSuccess = signal<string | null>(null);

  readonly validationNotesDraft = signal('');
  readonly isValidating = signal(false);
  readonly validationError = signal<string | null>(null);

  readonly isExportingPdf = signal(false);
  readonly pdfExportError = signal<string | null>(null);

  /** Comparación lado a lado abierta con el candidato seleccionado. */
  readonly isComparing = signal(false);

  /** Segundo clic de confirmación para descartar en bloque las detecciones pendientes. */
  readonly confirmDismissRest = signal(false);
  readonly isDismissingRest = signal(false);

  readonly isRetrying = signal(false);
  readonly retryError = signal<string | null>(null);

  readonly detections = computed<Detection[]>(() => this.analysis()?.detections ?? []);
  readonly detectionCount = computed(() => this.detections().length);
  readonly totalMatches = computed(() => this.detections().reduce((acc, d) => acc + d.matches.length, 0));

  readonly images = computed<AnalysisImage[]>(() => this.analysis()?.images ?? []);
  readonly imageCount = computed(() => this.images().length);
  readonly activeImage = computed<AnalysisImage | null>(() => this.images()[this.activeImageIndex()] ?? null);

  /** Detecciones de la imagen que se está viendo. */
  readonly imageDetections = computed<Detection[]>(() => {
    const image = this.activeImage();
    return image ? this.detections().filter((d) => d.imageId === image.id) : [];
  });

  readonly activeDet = computed<Detection | null>(() => this.imageDetections()[this.activeDetection()] ?? null);
  readonly bestSimilarity = computed<number | null>(() => this.activeDet()?.matches[0]?.similarity ?? null);

  /** Miniaturas de la tira de imágenes, con cuántas detecciones aportó cada una. */
  readonly imageTabs = computed(() =>
    this.images().map((image, index) => ({
      image,
      index,
      detectionCount: this.detections().filter((d) => d.imageId === image.id).length
    }))
  );

  readonly detectionChips = computed<DetectionChip[]>(() =>
    this.imageDetections().map((detection, index) => {
      const pct = Math.round(detection.confidence * 100);
      return {
        id: detection.id,
        index,
        pct,
        color: detectionColor(pct),
        verdict: detection.verdict,
        matchType: detection.matchType
      };
    })
  );

  readonly selectedCount = computed(() => this.selectedDetectionIds().size);

  /**
   * Detecciones sin decisión del perito. Mientras haya alguna, el backend no deja
   * abrir otra consulta: cada resultado se cierra con una validación.
   */
  readonly pendingDetections = computed(() => this.detections().filter((d) => d.validationStatus === 'pending'));
  readonly pendingCount = computed(() => this.pendingDetections().length);

  readonly activeMatchItem = computed<Match | null>(() => this.activeDet()?.matches[this.activeMatch()] ?? null);

  readonly matchVms = computed<MatchVm[]>(() =>
    (this.activeDet()?.matches ?? []).slice(0, 5).map((match, index) => {
      const pct = Math.round(match.similarity * 100);
      return { match, rank: index + 1, pct, band: confidenceBand(pct) };
    })
  );

  readonly summary = computed<ConfidenceSummary>(() => {
    const counts: ConfidenceSummary = { alta: 0, media: 0, baja: 0 };
    for (const vm of this.matchVms()) {
      if (vm.pct >= SIMILARITY_STRONG) {
        counts.alta++;
      } else if (vm.pct >= SIMILARITY_THRESHOLD) {
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

  /** Reprocesa un analisis fallido reutilizando la imagen ya almacenada. */
  retry(): void {
    const item = this.analysis();
    if (!item || this.isRetrying()) {
      return;
    }

    this.isRetrying.set(true);
    this.retryError.set(null);

    this.analysisService.retry(item.id).subscribe({
      next: (updated) => {
        this.isRetrying.set(false);
        this.analysis.set(updated);
        this.activeImageIndex.set(0);
        this.activeDetection.set(0);
        this.activeMatch.set(0);
      },
      error: (err) => {
        this.isRetrying.set(false);
        this.retryError.set(err.error?.error ?? 'No se pudo reintentar el análisis.');
      }
    });
  }

  selectImage(index: number): void {
    this.activeImageIndex.set(index);
    this.selectDetection(0);
  }

  selectDetection(index: number): void {
    this.activeDetection.set(index);
    this.activeMatch.set(0);
    this.validationNotesDraft.set(this.imageDetections()[index]?.validationNotes ?? '');
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
        this.goToNextPending();
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

  openCompare(index: number): void {
    this.activeMatch.set(index);
    this.isComparing.set(true);
  }

  closeCompare(): void {
    this.isComparing.set(false);
  }

  /** Lleva a la siguiente detección sin decisión, aunque esté en otra fotografía. */
  goToNextPending(): void {
    const pendiente = this.pendingDetections()[0];
    if (!pendiente) {
      return;
    }
    const imageIndex = this.images().findIndex((i) => i.id === pendiente.imageId);
    if (imageIndex >= 0 && imageIndex !== this.activeImageIndex()) {
      this.activeImageIndex.set(imageIndex);
    }
    const detIndex = this.imageDetections().findIndex((d) => d.id === pendiente.id);
    if (detIndex >= 0) {
      this.selectDetection(detIndex);
    }
  }

  /** Descarta de una vez las detecciones que quedan pendientes (p. ej. falsos positivos). */
  dismissRemaining(): void {
    const item = this.analysis();
    const pendientes = this.pendingDetections();
    if (!item || pendientes.length === 0 || this.isDismissingRest()) {
      return;
    }
    if (!this.confirmDismissRest()) {
      this.confirmDismissRest.set(true);
      return;
    }

    this.isDismissingRest.set(true);
    this.validationError.set(null);

    forkJoin(
      pendientes.map((d) =>
        this.analysisService.validateDetection(item.id, d.id, 'dismissed', 'Descartada en bloque por el perito.')
      )
    ).subscribe({
      next: (actualizadas) => {
        const porId = new Map(actualizadas.map((d) => [d.id, d]));
        const actual = this.analysis() ?? item;
        this.analysis.set({ ...actual, detections: actual.detections.map((d) => porId.get(d.id) ?? d) });
        this.isDismissingRest.set(false);
        this.confirmDismissRest.set(false);
        this.validationNotesDraft.set(this.activeDet()?.validationNotes ?? '');
      },
      error: (err) => {
        this.isDismissingRest.set(false);
        this.confirmDismissRest.set(false);
        this.validationError.set(err.error?.error ?? 'No se pudieron descartar las detecciones pendientes.');
      }
    });
  }

  cancelDismissRest(): void {
    this.confirmDismissRest.set(false);
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
        // El mensaje dice lo que pasa a continuacion: quien enrola desde un analisis
        // no tiene por que rellenar nada, pero si tiene que saber que alguien lo hara.
        this.enrollSuccess.set(
          `${catalogItems.length} ${catalogItems.length === 1 ? 'tatuaje agregado' : 'tatuajes agregados'} al catálogo. ` +
            'Quedan pendientes de clasificar: desde ahora el sistema los reconocerá si vuelven a aparecer, ' +
            'y supervisión les asignará banda y datos desde el catálogo.'
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
        this.activeImageIndex.set(0);
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
        this.retryError.set(null);
        this.isComparing.set(false);
        this.confirmDismissRest.set(false);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el análisis.');
      }
    });
  }
}
