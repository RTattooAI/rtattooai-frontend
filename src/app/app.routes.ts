import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', redirectTo: 'upload', pathMatch: 'full' },
      {
        path: 'upload',
        loadComponent: () => import('./features/analysis/upload/upload').then((m) => m.Upload)
      },
      {
        path: 'results/:id',
        loadComponent: () => import('./features/analysis/results/results').then((m) => m.Results)
      },
      {
        path: 'history',
        loadComponent: () => import('./features/history/history').then((m) => m.History)
      },
      {
        path: 'catalog/enroll',
        loadComponent: () => import('./features/catalog/enroll/enroll').then((m) => m.Enroll)
      },
      {
        path: 'catalog/bands',
        canActivate: [roleGuard(['admin', 'supervisor'])],
        loadComponent: () => import('./features/catalog/bands/bands').then((m) => m.Bands)
      },
      {
        path: 'reviews',
        canActivate: [roleGuard(['admin', 'supervisor'])],
        loadComponent: () => import('./features/reviews/reviews').then((m) => m.Reviews)
      },
      {
        path: 'admin/audit',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/admin/audit/audit').then((m) => m.AdminAudit)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/admin/users/users').then((m) => m.AdminUsers)
      },
      {
        path: 'admin/models',
        canActivate: [roleGuard(['admin', 'supervisor'])],
        loadComponent: () => import('./features/admin/models/models').then((m) => m.AdminModels)
      },
      {
        path: 'admin/dashboard',
        canActivate: [roleGuard(['admin', 'supervisor'])],
        loadComponent: () => import('./features/admin/dashboard/dashboard').then((m) => m.AdminDashboard)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
