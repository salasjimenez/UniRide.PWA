import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from './models';
import { SessionService } from './session.service';

export const roleGuard: CanActivateFn = (route) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const session = sessionService.session();
  const expectedRole = route.data['role'] as UserRole;

  if (!session || session.role !== expectedRole) {
    return router.createUrlTree(['/acceso']);
  }

  return true;
};
