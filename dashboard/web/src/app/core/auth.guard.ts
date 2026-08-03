/**
 * Guards de ruta.
 *
 * Son una comodidad de navegación, no una medida de seguridad: la protección
 * real está en la API, que exige un JWT válido en cada endpoint. Saltarse el
 * guard desde la consola del navegador solo muestra pantallas vacías.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SesionService } from './sesion.service';

/** Exige sesión activa; si no la hay, manda al login. */
export const guardSesion: CanActivateFn = () => {
  const sesion = inject(SesionService);
  const router = inject(Router);

  if (sesion.autenticado()) {
    return true;
  }
  return router.createUrlTree(['/entrar']);
};

/** Evita que un comercio ya logueado vuelva al login o al registro. */
export const guardInvitado: CanActivateFn = () => {
  const sesion = inject(SesionService);
  const router = inject(Router);

  if (!sesion.autenticado()) {
    return true;
  }
  return router.createUrlTree(['/panel']);
};
