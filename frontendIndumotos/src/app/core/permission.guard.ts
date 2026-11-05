import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const permissionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadAccess().pipe(
    map(() => auth.can('PERMISOS_ASIGNAR') ? true : router.createUrlTree(['/app']))
  );
};
