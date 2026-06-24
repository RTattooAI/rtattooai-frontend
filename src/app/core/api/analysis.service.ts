import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Analysis, AnalysisListItem } from '../models';

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

  create(image: File): Observable<Analysis> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http
      .post<Analysis>(`${environment.apiUrl}/analyses`, formData)
      .pipe(map(withSortedMatches));
  }

  list(): Observable<AnalysisListItem[]> {
    return this.http.get<AnalysisListItem[]>(`${environment.apiUrl}/analyses`);
  }

  getById(id: string): Observable<Analysis> {
    return this.http
      .get<Analysis>(`${environment.apiUrl}/analyses/${id}`)
      .pipe(map(withSortedMatches));
  }
}
