import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const publicAuth = request.url.endsWith('/api/v1/auth/login') || request.url.endsWith('/api/v1/auth/refresh');
  if (publicAuth) return next(request);
  return auth.ensureToken().pipe(switchMap(token => {
    if (!token) {
      void router.navigateByUrl('/login');
      return throwError(() => new Error('Sesión vencida'));
    }
    return next(request.clone({setHeaders:{Authorization:`Bearer ${token}`}})).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          auth.logout('Tu sesión ya no es válida. Ingresa de nuevo.');
          void router.navigateByUrl('/login');
        }
        return throwError(() => error);
      }));
  }));
};
