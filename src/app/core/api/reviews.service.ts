import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReviewItem } from '../models';

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);

  pending(): Observable<ReviewItem[]> {
    return this.http.get<ReviewItem[]>(`${environment.apiUrl}/reviews`);
  }
}
