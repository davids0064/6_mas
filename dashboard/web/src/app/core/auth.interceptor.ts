/**
 * Inyecta el token en cada petición y maneja el 401 de forma central.
 */

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { SesionService } from './sesion.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const token = sesion.token();

  // Las rutas de /auth son públicas: mandarles un token expirado provocaría
  // un 401 y, con el catch de abajo, un cierre de sesión en bucle.
  const esPublica = req.url.includes('/auth/');

  const peticion = token && !esPublica
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      // Un 401 en una ruta protegida solo puede significar token vencido o
      // inválido: se cierra la sesión y se manda al login, en vez de dejar al
      // usuario ante pantallas vacías sin explicación.
      if (error.status === 401 && !esPublica) {
        sesion.cerrarSesion();
      }
      return throwError(() => error);
    }),
  );
};
