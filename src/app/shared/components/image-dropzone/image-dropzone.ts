import { Component, input, output, signal } from '@angular/core';
import { Icon } from '../../ui';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** RF-01: JPG, PNG y WEBP. El backend vuelve a comprobarlo sobre los bytes reales. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-image-dropzone',
  imports: [Icon],
  templateUrl: './image-dropzone.html'
})
export class ImageDropzone {
  /**
   * En modo múltiple el componente no conserva vista previa: entrega los archivos y
   * es la pantalla quien gestiona la lista, porque allí se mezclan con las capturas
   * de cámara.
   */
  readonly multiple = input(false);

  readonly fileSelected = output<File>();
  readonly filesSelected = output<File[]>();
  readonly removed = output<void>();

  readonly previewUrl = signal<string | null>(null);
  readonly fileName = signal<string>('');
  readonly fileSize = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly isDragOver = signal(false);

  private previousUrl: string | null = null;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    this.handleFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  clear(): void {
    if (this.previousUrl) {
      URL.revokeObjectURL(this.previousUrl);
      this.previousUrl = null;
    }
    this.previewUrl.set(null);
    this.fileName.set('');
    this.fileSize.set('');
    this.error.set(null);
    this.removed.emit();
  }

  private handleFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    const validos: File[] = [];
    for (const file of files) {
      const problema = this.validate(file);
      if (problema) {
        this.error.set(problema);
        return;
      }
      validos.push(file);
    }

    this.error.set(null);

    if (this.multiple()) {
      this.filesSelected.emit(validos);
      return;
    }

    this.showSinglePreview(validos[0]);
  }

  private validate(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `"${file.name}": formato no válido. Solo se aceptan imágenes JPG, PNG o WEBP.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `"${file.name}" supera el tamaño máximo permitido de 10 MB.`;
    }
    return null;
  }

  private showSinglePreview(file: File): void {
    if (this.previousUrl) {
      URL.revokeObjectURL(this.previousUrl);
    }
    const url = URL.createObjectURL(file);
    this.previousUrl = url;
    this.previewUrl.set(url);
    this.fileName.set(file.name);
    this.fileSize.set(formatBytes(file.size));
    this.fileSelected.emit(file);
    this.filesSelected.emit([file]);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(0)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}
