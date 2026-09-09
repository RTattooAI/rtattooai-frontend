import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CatalogItem } from '../models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  enroll(image: File, band: string): Observable<CatalogItem> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('band', band);
    return this.http.post<CatalogItem>(`${environment.apiUrl}/catalog`, formData);
  }

  list(): Observable<CatalogItem[]> {
    return this.http.get<CatalogItem[]>(`${environment.apiUrl}/catalog`);
  }

  assignBand(catalogId: string, band: string): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(`${environment.apiUrl}/catalog/${catalogId}/band`, { band });
  }

  setValidated(catalogId: string, validated: boolean): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(`${environment.apiUrl}/catalog/${catalogId}/validation`, { validated });
  }
}
