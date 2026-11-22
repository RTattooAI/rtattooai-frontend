import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ReviewsService } from '../../core/api';
import { ReviewItem } from '../../core/models';
import { parseApiDate } from '../../core/utils/parse-api-date';
import { Icon, TattooThumb, ConfidenceBand, confidenceBand } from '../../shared/ui';

interface ReviewRow {
  item: ReviewItem;
  requestedAt: Date | null;
  confidencePct: number;
  similarityPct: number | null;
  band: ConfidenceBand | null;
}

/**
 * Bandeja de segunda revisión. Cierra el circuito de la validación pericial: hasta
 * ahora un analista podía marcar una detección como "en revisión" pero nadie tenía
 * dónde verla.
 */
@Component({
  selector: 'app-reviews',
  imports: [DatePipe, Icon, TattooThumb],
  templateUrl: './reviews.html'
})
export class Reviews implements OnInit {
  private readonly reviewsService = inject(ReviewsService);
  private readonly router = inject(Router);

  readonly items = signal<ReviewItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rows = computed<ReviewRow[]>(() =>
    this.items().map((item) => {
      const similarityPct = item.topSimilarity != null ? Math.round(item.topSimilarity * 100) : null;
      return {
        item,
        requestedAt: item.requestedAt ? parseApiDate(item.requestedAt) : null,
        confidencePct: Math.round(item.confidence * 100),
        similarityPct,
        band: similarityPct != null ? confidenceBand(similarityPct) : null
      };
    })
  );

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  open(item: ReviewItem): void {
    this.router.navigate(['/results', item.analysisId]);
  }

  private load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.reviewsService.pending().subscribe({
      next: (items) => {
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar la bandeja de revisión.');
      }
    });
  }
}
