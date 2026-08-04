/**
 * Inicio del panel: el estado del comercio de un vistazo.
 *
 * Toda la pantalla se resuelve con UNA petición a /resumen. Es deliberado:
 * con la base de datos en otro servidor, seis peticiones para pintar un home
 * serían seis viajes de red encadenados.
 */

import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api.service';
import { Resumen } from '../../../core/modelos';
import { mensajeDeError } from '../../../core/errores';

@Component({
  selector: 'panel-resumen',
  imports: [RouterLink, DatePipe],
  templateUrl: './resumen.html',
})
export class ResumenPagina {
  private api = inject(ApiService);

  readonly datos = signal<Resumen | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** A dónde lleva cada pendiente del onboarding. */
  private readonly rutaPorPendiente: Record<string, string> = {
    plan: '/panel/oferta',
    disponibilidad: '/panel/oferta',
    direccion: '/panel/mi-comercio',
    descripcion: '/panel/mi-comercio',
    anfitrion: '/panel/anfitriones',
    menu: '/panel/menus',
    propuesta: '/panel/propuestas',
  };

  constructor() {
    this.api.resumen().subscribe({
      next: (datos) => {
        this.datos.set(datos);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  ruta(clave: string): string {
    return this.rutaPorPendiente[clave] ?? '/panel';
  }
}
