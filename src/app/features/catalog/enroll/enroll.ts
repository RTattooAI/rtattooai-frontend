import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImageDropzone } from '../../../shared/components';
import { Icon, TattooThumb } from '../../../shared/ui';
import { CatalogService } from '../../../core/api';
import { AuthService } from '../../../core/auth';
import { CatalogItem } from '../../../core/models';
import { parseApiDate } from '../../../core/utils/parse-api-date';

interface CatalogRow {
  item: CatalogItem;
  date: Date;
}

@Component({
  selector: 'app-enroll',
  imports: [DatePipe, RouterLink, ImageDropzone, Icon, TattooThumb],
  templateUrl: './enroll.html'
})
export class Enroll implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly authService = inject(AuthService);

  /**
   * Solo supervision puede alterar el catalogo de referencia: quien lo modifica
   * cambia el resultado de cualquier analisis posterior. El backend lo impone;
   * aqui simplemente no se ofrecen acciones que el usuario no podria completar.
   */
  readonly canManage = this.authService.canSupervise();

  readonly validatingIds = signal<Set<string>>(new Set());

  readonly items = signal<CatalogItem[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly search = signal('');

  // Enrolment modal state
  readonly showForm = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly band = signal('');
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  // Inline band-assignment state, keyed by catalogId
  readonly bandDrafts = signal<Record<string, string>>({});
  readonly assigningIds = signal<Set<string>>(new Set());
  readonly assignErrors = signal<Record<string, string>>({});

  readonly rows = computed<CatalogRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    return this.items()
      .filter(
        (item) =>
          term === '' ||
          item.catalogId.toLowerCase().includes(term) ||
          (item.band ?? '').toLowerCase().includes(term)
      )
      .map((item) => ({ item, date: parseApiDate(item.addedAt) }));
  });

  readonly total = computed(() => this.items().length);
  readonly bandCount = computed(
    () => new Set(this.items().map((item) => item.band).filter((band): band is string => band !== null)).size
  );
  readonly validatedCount = computed(() => this.items().filter((item) => item.validated).length);
  readonly pendingCount = computed(() => this.total() - this.validatedCount());

  ngOnInit(): void {
    this.load();
  }

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  openForm(): void {
    this.selectedFile.set(null);
    this.band.set('');
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onFileSelected(file: File): void {
    this.selectedFile.set(file);
    this.formError.set(null);
  }

  onFileRemoved(): void {
    this.selectedFile.set(null);
  }

  onBandInput(event: Event): void {
    this.band.set((event.target as HTMLInputElement).value);
  }

  bandDraftFor(catalogId: string): string {
    return this.bandDrafts()[catalogId] ?? '';
  }

  isAssigning(catalogId: string): boolean {
    return this.assigningIds().has(catalogId);
  }

  assignErrorFor(catalogId: string): string | null {
    return this.assignErrors()[catalogId] ?? null;
  }

  onBandDraftInput(catalogId: string, event: Event): void {
    this.bandDrafts.set({ ...this.bandDrafts(), [catalogId]: (event.target as HTMLInputElement).value });
  }

  assignBand(catalogId: string): void {
    const band = this.bandDraftFor(catalogId).trim();
    if (!band || this.isAssigning(catalogId)) {
      return;
    }

    this.assigningIds.set(new Set([...this.assigningIds(), catalogId]));
    this.assignErrors.set({ ...this.assignErrors(), [catalogId]: '' });

    this.catalogService.assignBand(catalogId, band).subscribe({
      next: (updated) => {
        const nextAssigning = new Set(this.assigningIds());
        nextAssigning.delete(catalogId);
        this.assigningIds.set(nextAssigning);
        this.items.set(this.items().map((item) => (item.catalogId === catalogId ? updated : item)));
      },
      error: (err) => {
        const nextAssigning = new Set(this.assigningIds());
        nextAssigning.delete(catalogId);
        this.assigningIds.set(nextAssigning);
        this.assignErrors.set({
          ...this.assignErrors(),
          [catalogId]: err.error?.error ?? 'No se pudo asignar la banda. Intenta de nuevo.'
        });
      }
    });
  }

  isValidating(catalogId: string): boolean {
    return this.validatingIds().has(catalogId);
  }

  /** Compuerta de revision humana del catalogo. */
  toggleValidated(item: CatalogItem): void {
    if (!this.canManage || this.isValidating(item.catalogId)) {
      return;
    }

    this.validatingIds.set(new Set([...this.validatingIds(), item.catalogId]));
    this.assignErrors.set({ ...this.assignErrors(), [item.catalogId]: '' });

    this.catalogService.setValidated(item.catalogId, !item.validated).subscribe({
      next: (updated) => {
        this.clearValidating(item.catalogId);
        this.items.set(this.items().map((i) => (i.catalogId === item.catalogId ? updated : i)));
      },
      error: (err) => {
        this.clearValidating(item.catalogId);
        this.assignErrors.set({
          ...this.assignErrors(),
          [item.catalogId]: err.error?.error ?? 'No se pudo cambiar la validación.'
        });
      }
    });
  }

  private clearValidating(catalogId: string): void {
    const next = new Set(this.validatingIds());
    next.delete(catalogId);
    this.validatingIds.set(next);
  }

  onSubmit(): void {
    const file = this.selectedFile();
    const band = this.band().trim();
    if (!file || !band || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set(null);

    this.catalogService.enroll(file, band).subscribe({
      next: (item) => {
        this.isSubmitting.set(false);
        this.showForm.set(false);
        this.success.set(`Tatuaje "${item.catalogId}" agregado a la banda ${item.band}.`);
        this.load();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.formError.set(err.error?.error ?? 'No se pudo enrolar el tatuaje. Intenta de nuevo.');
      }
    });
  }

  private load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.catalogService.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set('No se pudo cargar el catálogo.');
      }
    });
  }
}
