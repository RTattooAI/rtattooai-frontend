import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ModelInventory, ModelVersion } from '../models';

/** Versiones del modelo de IA y sus métricas (RF-16). */
@Injectable({ providedIn: 'root' })
export class ModelsService {
  private readonly http = inject(HttpClient);

  inventory(): Observable<ModelInventory> {
    return this.http.get<ModelInventory>(`${environment.apiUrl}/models`);
  }

  save(version: Partial<ModelVersion> & { identifier: string }): Observable<ModelVersion> {
    return this.http.put<ModelVersion>(`${environment.apiUrl}/models`, version);
  }
}
