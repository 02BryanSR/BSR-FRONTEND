import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const authReq = token
    ? req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`),
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const message = getHttpErrorMessage(error);

      if (error.status === 401 && req.url !== API_ENDPOINTS.auth.login) {
        authService.logout({ redirectToLogin: false });
        void router.navigate(['/login']);
      }

      return throwError(
        () =>
          new HttpErrorResponse({
            error: {
              ...(typeof error.error === 'object' && error.error !== null ? error.error : {}),
              message,
            },
            headers: error.headers,
            status: error.status,
            statusText: error.statusText,
            url: error.url ?? undefined,
          }),
      );
    }),
  );
};

function getHttpErrorMessage(error: HttpErrorResponse): string {
  const serverMessage = resolveServerErrorMessage(error.error);

  if (serverMessage) {
    return serverMessage;
  }

  switch (error.status) {
    case 0:
      return 'No se pudo conectar con el servidor.';
    case 401:
      return 'Email o contraseña incorrectos.';
    case 403:
      return 'Acceso restringido.';
    case 404:
      return 'El recurso solicitado no ha sido encontrado.';
    case 500:
      return 'Error interno del servidor.';
    default:
      return 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}

function resolveServerErrorMessage(errorBody: unknown): string | null {
  if (typeof errorBody === 'string') {
    const normalizedMessage = errorBody.trim();
    return normalizedMessage || null;
  }

  if (!errorBody || typeof errorBody !== 'object') {
    return null;
  }

  const candidate = (errorBody as { message?: unknown; error?: unknown }).message;

  if (typeof candidate === 'string') {
    const normalizedMessage = candidate.trim();
    return normalizedMessage || null;
  }

  const nestedError = (errorBody as { error?: unknown }).error;

  if (typeof nestedError === 'string') {
    const normalizedMessage = nestedError.trim();
    return normalizedMessage || null;
  }

  return null;
}
