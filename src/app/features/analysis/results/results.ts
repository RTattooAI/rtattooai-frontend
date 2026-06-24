import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AnalysisService } from '../../../core/api';
import { Analysis, Detection, Match } from '../../../core/models';
import { BboxOverlay, ConfidenceSemaforo, DisclaimerBanner } from '../../../shared/components';
import { Icon, TattooThumb, ConfidenceBand, confidenceBand, detectionColor } from '../../../shared/ui';

interface MatchVm {
  match: Match;
  rank: number;
  pct: number;
  band: ConfidenceBand;
}

interface DetectionChip {
  index: number;
  pct: number;
  color: string;
  verdict: Detection['verdict'];
}

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

  readonly detections = computed<Detection[]>(() => this.analysis()?.detections ?? []);
  readonly detectionCount = computed(() => this.detections().length);
  readonly totalMatches = computed(() => this.detections().reduce((acc, d) => acc + d.matches.length, 0));

  readonly activeDet = computed<Detection | null>(() => this.detections()[this.activeDetection()] ?? null);
  readonly bestSimilarity = computed<number | null>(() => this.activeDet()?.matches[0]?.similarity ?? null);

  readonly detectionChips = computed<DetectionChip[]>(() =>
    this.detections().map((detection, index) => {
      const pct = Math.round(detection.confidence * 100);
      return { index, pct, color: detectionColor(pct), verdict: detection.verdict };
    })
  );

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
  }

  selectMatch(index: number): void {
    this.activeMatch.set(index);
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.analysisService.getById(id).subscribe({
      next: (analysis) => {
        this.analysis.set(analysis);
        this.activeDetection.set(0);
        this.activeMatch.set(0);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el análisis.');
      }
    });
  }
}
