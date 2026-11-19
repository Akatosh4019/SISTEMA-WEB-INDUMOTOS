import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const permissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadAccess().pipe(
    map(() => {
      const permissions: string[] = route.data['permissions'] ?? [route.data['permission'] ?? 'PERMISOS_ASIGNAR'];
      return permissions.some(permission => auth.can(permission))
        ? true : router.createUrlTree(['/app']);
    })
  );
};
