import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CameraCapture, ImageDropzone, ImageEditor } from '../../../shared/components';
import { Icon } from '../../../shared/ui';
import { AnalysisService } from '../../../core/api';
import { ImageSource } from '../../../core/models';

/** Mismo tope que aplica el backend (AnalysisService.MaxImagesPerAnalysis). */
const MAX_IMAGES = 10;

interface PendingImage {
  file: File;
  previewUrl: string;
  source: ImageSource;
}

@Component({
  selector: 'app-upload',
  imports: [ImageDropzone, CameraCapture, ImageEditor, Icon],
  templateUrl: './upload.html'
})
export class Upload {
  private readonly analysisService = inject(AnalysisService);
  private readonly router = inject(Router);

  readonly maxImages = MAX_IMAGES;

  /** Un caso puede necesitar varias tomas: distintas zonas del cuerpo o distintos ángulos. */
  readonly images = signal<PendingImage[]>([]);
  readonly showCamera = signal(false);

  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly personName = signal('');
  readonly documentId = signal('');
  readonly notes = signal('');

  /** Indice de la fotografia que se esta ajustando (RF-02), o null si el editor esta cerrado. */
  readonly editingIndex = signal<number | null>(null);

  readonly editingFile = computed(() => {
    const index = this.editingIndex();
    return index === null ? null : (this.images()[index]?.file ?? null);
  });

  readonly imageCount = computed(() => this.images().length);
  readonly canAddMore = computed(() => this.imageCount() < MAX_IMAGES);
  readonly hasCameraShots = computed(() => this.images().some((i) => i.source === 'camara'));

  onFilesSelected(files: File[]): void {
    this.addImages(files, 'archivo');
  }

  onCameraCaptured(files: File[]): void {
    this.addImages(files, 'camara');
    this.showCamera.set(false);
  }

  toggleCamera(): void {
    this.showCamera.update((open) => !open);
  }

  editImage(index: number): void {
    this.editingIndex.set(index);
  }

  closeEditor(): void {
    this.editingIndex.set(null);
  }

  /**
   * Sustituye la fotografia por su version ajustada. La original se descarta aqui
   * mismo: lo que se analice y lo que quede en el expediente deben ser la misma imagen.
   */
  onImageEdited(edited: File): void {
    const index = this.editingIndex();
    if (index === null) {
      return;
    }

    const actuales = this.images();
    const anterior = actuales[index];
    if (!anterior) {
      this.editingIndex.set(null);
      return;
    }

    URL.revokeObjectURL(anterior.previewUrl);

    this.images.set(
      actuales.map((image, i) =>
        i === index ? { file: edited, previewUrl: URL.createObjectURL(edited), source: image.source } : image
      )
    );
    this.editingIndex.set(null);
    this.error.set(null);
  }

  removeImage(index: number): void {
    const actuales = this.images();
    URL.revokeObjectURL(actuales[index].previewUrl);
    this.images.set(actuales.filter((_, i) => i !== index));
    // Quitar una foto desplaza los indices: el editor abierto apuntaria a otra.
    this.editingIndex.set(null);
    this.error.set(null);
  }

  clearImages(): void {
    for (const image of this.images()) {
      URL.revokeObjectURL(image.previewUrl);
    }
    this.images.set([]);
    this.editingIndex.set(null);
    this.error.set(null);
  }

  onPersonNameInput(event: Event): void {
    this.personName.set((event.target as HTMLInputElement).value);
  }

  onDocumentIdInput(event: Event): void {
    this.documentId.set((event.target as HTMLInputElement).value);
  }

  onNotesInput(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  onAnalyze(): void {
    const images = this.images();
    if (images.length === 0 || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    // El origen del análisis es "camara" solo si todas las tomas vienen de ahí; en una
    // mezcla prevalece la carga de archivos, que es el caso general.
    const source: ImageSource = images.every((i) => i.source === 'camara') ? 'camara' : 'archivo';

    this.analysisService
      .create(
        images.map((i) => i.file),
        this.personName().trim(),
        this.documentId().trim(),
        this.notes().trim(),
        source
      )
      .subscribe({
        next: (analysis) => {
          this.clearImages();
          this.router.navigate(['/results', analysis.id]);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.error.set(err.error?.error ?? 'No se pudieron enviar las imágenes. Intente de nuevo.');
        }
      });
  }

  private addImages(files: File[], source: ImageSource): void {
    const disponibles = MAX_IMAGES - this.imageCount();
    if (disponibles <= 0) {
      this.error.set(`Un análisis admite como máximo ${MAX_IMAGES} imágenes.`);
      return;
    }

    const aceptadas = files.slice(0, disponibles);
    this.images.set([
      ...this.images(),
      ...aceptadas.map((file) => ({ file, previewUrl: URL.createObjectURL(file), source }))
    ]);

    this.error.set(
      files.length > disponibles
        ? `Solo se añadieron ${aceptadas.length}: un análisis admite como máximo ${MAX_IMAGES} imágenes.`
        : null
    );
  }
}
