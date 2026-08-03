/**
 * Traduce un error HTTP al mensaje que se le muestra al comercio.
 *
 * La API responde siempre { error: "..." } con textos ya redactados en tono
 * cercano; esta función solo cubre los casos donde no hay respuesta útil
 * (red caída, servidor apagado) para que el usuario nunca vea "Http failure
 * response for http://localhost:8080/...".
 */

import { HttpErrorResponse } from '@angular/common/http';

export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    }
    const detalle = (error.error as { error?: string } | null)?.error;
    if (detalle) {
      return detalle;
    }
    if (error.status >= 500) {
      return 'Algo falló de nuestro lado. Inténtalo en unos momentos.';
    }
  }
  return 'Ocurrió un error inesperado.';
}
