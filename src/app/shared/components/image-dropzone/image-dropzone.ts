import { Component, output, signal } from '@angular/core';
import { Icon } from '../../ui';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];

@Component({
  selector: 'app-image-dropzone',
  imports: [Icon],
  templateUrl: './image-dropzone.html'
})
export class ImageDropzone {
  readonly fileSelected = output<File>();
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
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
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

  private handleFile(file: File): void {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.error.set('Formato no válido. Solo se aceptan imágenes JPG o PNG.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      this.error.set('El archivo supera el tamaño máximo permitido de 10 MB.');
      return;
    }

    this.error.set(null);
    if (this.previousUrl) {
      URL.revokeObjectURL(this.previousUrl);
    }
    const url = URL.createObjectURL(file);
    this.previousUrl = url;
    this.previewUrl.set(url);
    this.fileName.set(file.name);
    this.fileSize.set(formatBytes(file.size));
    this.fileSelected.emit(file);
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
