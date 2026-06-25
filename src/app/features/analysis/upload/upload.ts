import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ImageDropzone } from '../../../shared/components';
import { Icon } from '../../../shared/ui';
import { AnalysisService } from '../../../core/api';

@Component({
  selector: 'app-upload',
  imports: [ImageDropzone, Icon],
  templateUrl: './upload.html'
})
export class Upload {
  private readonly analysisService = inject(AnalysisService);
  private readonly router = inject(Router);

  readonly selectedFile = signal<File | null>(null);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly personName = signal('');
  readonly documentId = signal('');
  readonly notes = signal('');

  onFileSelected(file: File): void {
    this.selectedFile.set(file);
    this.error.set(null);
  }

  onFileRemoved(): void {
    this.selectedFile.set(null);
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
    const file = this.selectedFile();
    if (!file || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    this.analysisService
      .create(file, this.personName().trim(), this.documentId().trim(), this.notes().trim())
      .subscribe({
        next: (analysis) => this.router.navigate(['/results', analysis.id]),
        error: (err) => {
          this.isSubmitting.set(false);
          this.error.set(err.error?.error ?? 'No se pudo enviar la imagen. Intenta de nuevo.');
        }
      });
  }
}
