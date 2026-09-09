import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Analysis,
  AnalysisListItem,
  AnalysisPreview,
  CatalogItem,
  Detection,
  ImageSource,
  ValidationStatus
} from '../models';

/** El backend no garantiza que `matches` venga ordenado por similitud descendente. */
function withSortedMatches(analysis: Analysis): Analysis {
  return {
    ...analysis,
    detections: analysis.detections.map((detection) => ({
      ...detection,
      matches: [...detection.matches].sort((a, b) => b.similarity - a.similarity)
    }))
  };
}

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly http = inject(HttpClient);

  /** Un análisis admite varias fotografías del mismo caso; todas viajan en `images`. */
  create(
    images: File[],
    personName?: string,
    documentId?: string,
    notes?: string,
    source: ImageSource = 'archivo'
  ): Observable<Analysis> {
    const formData = new FormData();
    for (const image of images) {
      formData.append('images', image);
    }
    formData.append('source', source);
    if (personName) formData.append('personName', personName);
    if (documentId) formData.append('documentId', documentId);
    if (notes) formData.append('notes', notes);
    return this.http
      .post<Analysis>(`${environment.apiUrl}/analyses`, formData)
      .pipe(map(withSortedMatches));
  }

  /**
   * Modo asistido en vivo: analiza un fotograma sin guardarlo. Se invoca en bucle
   * mientras la cámara está encendida, así que el fotograma va reducido.
   */
  preview(frame: Blob): Observable<AnalysisPreview> {
    const formData = new FormData();
    formData.append('image', frame, 'frame.jpg');
    return this.http.post<AnalysisPreview>(`${environment.apiUrl}/analyses/preview`, formData);
  }

  /** `scope: 'all'` solo tiene efecto para supervisor/admin; el backend lo vuelve a comprobar. */
  list(scope: 'mine' | 'all' = 'mine'): Observable<AnalysisListItem[]> {
    return this.http.get<AnalysisListItem[]>(`${environment.apiUrl}/analyses`, { params: { scope } });
  }

  retry(id: string): Observable<Analysis> {
    return this.http
      .post<Analysis>(`${environment.apiUrl}/analyses/${id}/retry`, {})
      .pipe(map(withSortedMatches));
  }

  exportCsv(scope: 'mine' | 'all' = 'all'): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/analyses/export`, {
      params: { scope },
      responseType: 'blob'
    });
  }

  getById(id: string): Observable<Analysis> {
    return this.http
      .get<Analysis>(`${environment.apiUrl}/analyses/${id}`)
      .pipe(map(withSortedMatches));
  }

  enrollDetections(analysisId: string, detectionIds: string[]): Observable<CatalogItem[]> {
    return this.http.post<CatalogItem[]>(`${environment.apiUrl}/analyses/${analysisId}/enroll`, {
      detectionIds
    });
  }

  validateDetection(
    analysisId: string,
    detectionId: string,
    status: Exclude<ValidationStatus, 'pending'>,
    notes: string | null
  ): Observable<Detection> {
    return this.http.patch<Detection>(
      `${environment.apiUrl}/analyses/${analysisId}/detections/${detectionId}/validation`,
      { status, notes }
    );
  }
}
