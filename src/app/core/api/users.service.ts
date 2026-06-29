import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserListItem, UserRole } from '../models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(): Observable<UserListItem[]> {
    return this.http.get<UserListItem[]>(`${environment.apiUrl}/users`);
  }

  create(fullName: string, email: string, password: string, role: UserRole): Observable<UserListItem> {
    return this.http.post<UserListItem>(`${environment.apiUrl}/users`, { fullName, email, password, role });
  }

  setActive(id: string, active: boolean): Observable<UserListItem> {
    return this.http.patch<UserListItem>(`${environment.apiUrl}/users/${id}/status`, { active });
  }
}
