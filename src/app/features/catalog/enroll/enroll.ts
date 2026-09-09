import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImageDropzone } from '../../../shared/components';
import { Icon, TattooThumb } from '../../../shared/ui';
import { CatalogService } from '../../../core/api';
import { AuthService } from '../../../core/auth';
import { CatalogFacets, CatalogFilters, CatalogItem, CatalogMetadata } from '../../../core/models';
import { parseApiDate } from '../../../core/utils/parse-api-date';

interface CatalogRow {
  item: CatalogItem;
  date: Date;
}

const SEARCH_DEBOUNCE_MS = 350;

const EMPTY_FACETS: CatalogFacets = { bands: [], categories: [], bodyLocations: [], tags: [] };

@Component({
  selector: 'app-enroll',
  imports: [DatePipe, RouterLink, ImageDropzone, Icon, TattooThumb],
  templateUrl: './enroll.html'
})
export class Enroll implements OnInit, OnDestroy {
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
  readonly facets = signal<CatalogFacets>(EMPTY_FACETS);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  // Filtros (RF-09). Se resuelven en el servidor para que el resultado no dependa
  // de cuantas entradas se hayan traido.
  readonly search = signal('');
  readonly categoryFilter = signal('');
  readonly bodyLocationFilter = signal('');
  readonly tagFilter = signal('');
  readonly validatedFilter = signal<'all' | 'yes' | 'no'>('all');

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Alta de una entrada del catalogo.
  readonly showForm = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly band = signal('');
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  // Campos descriptivos, compartidos entre el alta y la edicion.
  readonly metaName = signal('');
  readonly metaDescription = signal('');
  readonly metaCategory = signal('');
  readonly metaBodyLocation = signal('');
  readonly metaTags = signal('');

  // Edicion de los campos descriptivos de una entrada existente.
  readonly editingId = signal<string | null>(null);
  readonly isSavingMeta = signal(false);
  readonly metaError = signal<string | null>(null);

  // Asignacion de banda en linea, por catalogId.
  readonly bandDrafts = signal<Record<string, string>>({});
  readonly assigningIds = signal<Set<string>>(new Set());
  readonly assignErrors = signal<Record<string, string>>({});

  readonly hasFilters = computed(
    () =>
      this.search().trim() !== '' ||
      this.categoryFilter() !== '' ||
      this.bodyLocationFilter() !== '' ||
      this.tagFilter() !== '' ||
      this.validatedFilter() !== 'all'
  );

  readonly rows = computed<CatalogRow[]>(() =>
    this.items().map((item) => ({ item, date: parseApiDate(item.addedAt) }))
  );

  readonly total = computed(() => this.items().length);
  readonly bandCount = computed(
    () => new Set(this.items().map((item) => item.band).filter((band): band is string => band !== null)).size
  );
  readonly validatedCount = computed(() => this.items().filter((item) => item.validated).length);
  readonly pendingCount = computed(() => this.total() - this.validatedCount());

  ngOnInit(): void {
    this.load();
    this.loadFacets();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  onCategoryChange(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  onBodyLocationChange(event: Event): void {
    this.bodyLocationFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  onTagChange(event: Event): void {
    this.tagFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  onValidatedChange(event: Event): void {
    this.validatedFilter.set((event.target as HTMLSelectElement).value as 'all' | 'yes' | 'no');
    this.load();
  }

  clearFilters(): void {
    this.search.set('');
    this.categoryFilter.set('');
    this.bodyLocationFilter.set('');
    this.tagFilter.set('');
    this.validatedFilter.set('all');
    this.load();
  }

  openForm(): void {
    this.selectedFile.set(null);
    this.band.set('');
    this.resetMetadata();
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

  onMetaNameInput(event: Event): void {
    this.metaName.set((event.target as HTMLInputElement).value);
  }

  onMetaDescriptionInput(event: Event): void {
    this.metaDescription.set((event.target as HTMLTextAreaElement).value);
  }

  onMetaCategoryInput(event: Event): void {
    this.metaCategory.set((event.target as HTMLInputElement).value);
  }

  onMetaBodyLocationInput(event: Event): void {
    this.metaBodyLocation.set((event.target as HTMLInputElement).value);
  }

  onMetaTagsInput(event: Event): void {
    this.metaTags.set((event.target as HTMLInputElement).value);
  }

  /** Edita solo los campos descriptivos: la imagen no se puede sustituir. */
  openEditMetadata(item: CatalogItem): void {
    this.editingId.set(item.catalogId);
    this.metaName.set(item.name ?? '');
    this.metaDescription.set(item.description ?? '');
    this.metaCategory.set(item.category ?? '');
    this.metaBodyLocation.set(item.bodyLocation ?? '');
    this.metaTags.set(item.tags.join(', '));
    this.metaError.set(null);
  }

  closeEditMetadata(): void {
    this.editingId.set(null);
  }

  saveMetadata(): void {
    const catalogId = this.editingId();
    if (!catalogId || this.isSavingMeta()) {
      return;
    }

    this.isSavingMeta.set(true);
    this.metaError.set(null);

    this.catalogService.updateMetadata(catalogId, this.metadata()).subscribe({
      next: (updated) => {
        this.isSavingMeta.set(false);
        this.editingId.set(null);
        this.items.set(this.items().map((item) => (item.catalogId === catalogId ? updated : item)));
        this.loadFacets();
      },
      error: (err) => {
        this.isSavingMeta.set(false);
        this.metaError.set(err.error?.error ?? 'No se pudieron guardar los datos.');
      }
    });
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
        this.loadFacets();
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

  onSubmit(): void {
    const file = this.selectedFile();
    const band = this.band().trim();
    if (!file || !band || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set(null);

    this.catalogService.enroll(file, band, this.metadata()).subscribe({
      next: (item) => {
        this.isSubmitting.set(false);
        this.showForm.set(false);
        this.success.set(`Tatuaje "${item.catalogId}" agregado a la banda ${item.band}.`);
        this.load();
        this.loadFacets();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.formError.set(err.error?.error ?? 'No se pudo enrolar el tatuaje. Intenta de nuevo.');
      }
    });
  }

  private metadata(): CatalogMetadata {
    return {
      name: this.metaName().trim() || null,
      description: this.metaDescription().trim() || null,
      category: this.metaCategory().trim() || null,
      bodyLocation: this.metaBodyLocation().trim() || null,
      tags: this.metaTags().trim() || null
    };
  }

  private resetMetadata(): void {
    this.metaName.set('');
    this.metaDescription.set('');
    this.metaCategory.set('');
    this.metaBodyLocation.set('');
    this.metaTags.set('');
  }

  private clearValidating(catalogId: string): void {
    const next = new Set(this.validatingIds());
    next.delete(catalogId);
    this.validatingIds.set(next);
  }

  private filters(): CatalogFilters {
    const validated = this.validatedFilter();
    return {
      q: this.search().trim() || undefined,
      category: this.categoryFilter() || undefined,
      bodyLocation: this.bodyLocationFilter() || undefined,
      tag: this.tagFilter() || undefined,
      validated: validated === 'all' ? undefined : validated === 'yes'
    };
  }

  private load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.catalogService.list(this.filters()).subscribe({
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

  /** Los desplegables solo ofrecen valores que existen: un filtro vacío no ayuda a nadie. */
  private loadFacets(): void {
    this.catalogService.facets().subscribe({
      next: (facets) => this.facets.set(facets),
      error: () => this.facets.set(EMPTY_FACETS)
    });
  }
}
