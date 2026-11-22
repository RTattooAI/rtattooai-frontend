import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CatalogFacets, CatalogFilters, CatalogItem, CatalogMetadata } from '../models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  enroll(image: File, band: string, metadata: CatalogMetadata = {}): Observable<CatalogItem> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('band', band);
    for (const [key, value] of Object.entries(metadata)) {
      if (value) {
        formData.append(key, value);
      }
    }
    return this.http.post<CatalogItem>(`${environment.apiUrl}/catalog`, formData);
  }

  list(filters: CatalogFilters = {}): Observable<CatalogItem[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<CatalogItem[]>(`${environment.apiUrl}/catalog`, { params });
  }

  /** Valores presentes en el catálogo, para ofrecer filtros que devuelvan algo. */
  facets(): Observable<CatalogFacets> {
    return this.http.get<CatalogFacets>(`${environment.apiUrl}/catalog/facets`);
  }

  assignBand(catalogId: string, band: string): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(`${environment.apiUrl}/catalog/${catalogId}/band`, { band });
  }

  /** Campos descriptivos (RF-09). La imagen no se puede sustituir. */
  updateMetadata(catalogId: string, metadata: CatalogMetadata): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(`${environment.apiUrl}/catalog/${catalogId}`, metadata);
  }

  setValidated(catalogId: string, validated: boolean): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(`${environment.apiUrl}/catalog/${catalogId}/validation`, { validated });
  }
}
