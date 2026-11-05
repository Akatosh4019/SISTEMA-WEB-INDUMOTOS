import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const login = request.url.endsWith('/api/v1/auth/login');
  const token = login ? '' : auth.token();
  const authorized = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(authorized).pipe(catchError((error: unknown) => {
    if (!login && error instanceof HttpErrorResponse && error.status === 401) {
      auth.logout('Tu sesión ya no es válida. Ingresa de nuevo.');
      void router.navigateByUrl('/login');
    }
    return throwError(() => error);
  }));
};
