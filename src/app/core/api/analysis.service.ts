import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Analysis,
  AnalysisListItem,
  AnalysisPreview,
  CatalogItem,
  Detection,
  ImageSource,
  PagedResult,
  ValidationStatus
} from '../models';

/** Filtros del historial (RF-13). Las fechas van en formato yyyy-MM-dd. */
export interface HistoryFilters {
  from?: string;
  to?: string;
  status?: string;
  q?: string;
}

function toParams(scope: 'mine' | 'all', filters: HistoryFilters): HttpParams {
  let params = new HttpParams().set('scope', scope);
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params = params.set(key, value);
    }
  }
  return params;
}

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

  /**
   * Historial paginado. `scope: 'all'` solo tiene efecto para supervisor/admin; el
   * backend lo vuelve a comprobar. El filtrado ocurre en el servidor, de modo que
   * buscar no depende de cuántos registros se hayan traído.
   */
  list(
    scope: 'mine' | 'all' = 'mine',
    filters: HistoryFilters = {},
    page = 1,
    pageSize = 25
  ): Observable<PagedResult<AnalysisListItem>> {
    return this.http.get<PagedResult<AnalysisListItem>>(`${environment.apiUrl}/analyses`, {
      params: toParams(scope, filters).set('page', page).set('pageSize', pageSize)
    });
  }

  retry(id: string): Observable<Analysis> {
    return this.http
      .post<Analysis>(`${environment.apiUrl}/analyses/${id}/retry`, {})
      .pipe(map(withSortedMatches));
  }

  exportCsv(scope: 'mine' | 'all' = 'all', filters: HistoryFilters = {}): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/analyses/export`, {
      params: toParams(scope, filters),
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
