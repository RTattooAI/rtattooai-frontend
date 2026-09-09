import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditEntry } from '../models';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  recent(limit = 100): Observable<AuditEntry[]> {
    return this.http.get<AuditEntry[]>(`${environment.apiUrl}/audit`, { params: { limit } });
  }
}
