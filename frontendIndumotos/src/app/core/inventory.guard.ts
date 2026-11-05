import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const inventoryGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadAccess().pipe(
    map(() => auth.can('INVENTARIO_CONSULTAR') ? true : router.createUrlTree(['/app'])),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};
