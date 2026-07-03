import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/// <summary>
/// Modern Angular functional route guard checking if a user is authenticated.
/// If not logged in, redirects automatically to the login view.
/// </summary>
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Redirect to login page
  return router.parseUrl('/login');
};
