import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditEntry, PagedResult } from '../models';

export interface AuditFilters {
  from?: string;
  to?: string;
  action?: string;
  userEmail?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  list(filters: AuditFilters = {}, page = 1, pageSize = 50): Observable<PagedResult<AuditEntry>> {
    return this.http.get<PagedResult<AuditEntry>>(`${environment.apiUrl}/audit`, {
      params: toParams(filters).set('page', page).set('pageSize', pageSize)
    });
  }

  /** Exportación del registro para el expediente de validación (RF-17). */
  exportCsv(filters: AuditFilters = {}): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/audit/export`, {
      params: toParams(filters),
      responseType: 'blob'
    });
  }
}

function toParams(filters: AuditFilters): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params = params.set(key, value);
    }
  }
  return params;
}
