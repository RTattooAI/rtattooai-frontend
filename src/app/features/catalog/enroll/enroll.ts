import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ImageDropzone } from '../../../shared/components';
import { Icon, TattooThumb } from '../../../shared/ui';
import { CatalogService } from '../../../core/api';
import { CatalogItem } from '../../../core/models';
import { parseApiDate } from '../../../core/utils/parse-api-date';

interface CatalogRow {
  item: CatalogItem;
  date: Date;
}

@Component({
  selector: 'app-enroll',
  imports: [DatePipe, ImageDropzone, Icon, TattooThumb],
  templateUrl: './enroll.html'
})
export class Enroll implements OnInit {
  private readonly catalogService = inject(CatalogService);

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
