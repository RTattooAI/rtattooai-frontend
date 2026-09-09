import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardMetrics } from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${environment.apiUrl}/dashboard/metrics`);
  }

  /** Las mismas métricas del panel en CSV (RF-17). */
  exportCsv(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/dashboard/metrics/export`, { responseType: 'blob' });
  }
}
