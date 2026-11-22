import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Band, SaveBandRequest } from '../models';

/** Mantenimiento de bandas criminales (RF-10). */
@Injectable({ providedIn: 'root' })
export class BandsService {
  private readonly http = inject(HttpClient);

  list(includeInactive = true): Observable<Band[]> {
    return this.http.get<Band[]>(`${environment.apiUrl}/bands`, {
      params: { includeInactive }
    });
  }

  create(request: SaveBandRequest): Observable<Band> {
    return this.http.post<Band>(`${environment.apiUrl}/bands`, request);
  }

  update(id: string, request: SaveBandRequest): Observable<Band> {
    return this.http.put<Band>(`${environment.apiUrl}/bands/${id}`, request);
  }

  setActive(id: string, active: boolean): Observable<Band> {
    return this.http.patch<Band>(`${environment.apiUrl}/bands/${id}/status`, { active });
  }

  /** Falla con 409 si la banda todavía tiene tatuajes en el catálogo. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/bands/${id}`);
  }
}
