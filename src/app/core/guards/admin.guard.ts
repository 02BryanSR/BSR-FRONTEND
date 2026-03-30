import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

function checkAdminAccess(): boolean | UrlTree {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (!authService.isAdmin()) {
    return router.createUrlTree([authService.getHomeRoute()]);
  }

  return true;
}

export const adminGuard: CanActivateFn = () => checkAdminAccess();
export const adminChildGuard: CanActivateChildFn = () => checkAdminAccess();
