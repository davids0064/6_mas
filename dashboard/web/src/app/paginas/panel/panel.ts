/**
 * Layout del panel privado: menú lateral persistente + área de contenido.
 *
 * El menú no cambia entre secciones, así que el comercio siempre sabe dónde
 * está y qué más puede hacer. En móvil se convierte en una fila desplazable
 * arriba (ver el media query de styles.css).
 */

import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SesionService } from '../../core/sesion.service';

@Component({
  selector: 'pagina-panel',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './panel.html',
})
export class Panel {
  private sesion = inject(SesionService);

  readonly comercio = this.sesion.comercio;

  readonly secciones = [
    // `exacta` solo para Inicio: sin eso, su enlace quedaría activo en todas
    // las rutas hijas porque '/panel' es prefijo de todas.
    { ruta: '/panel', etiqueta: 'Inicio', emoji: '🏠', exacta: true },
    { ruta: '/panel/mi-comercio', etiqueta: 'Mi comercio', emoji: '🏪', exacta: false },
    { ruta: '/panel/menus', etiqueta: 'Menús', emoji: '📖', exacta: false },
    { ruta: '/panel/propuestas', etiqueta: 'Propuestas', emoji: '🎁', exacta: false },
    { ruta: '/panel/anfitriones', etiqueta: 'Anfitriones', emoji: '🤝', exacta: false },
    { ruta: '/panel/eventos', etiqueta: 'Eventos', emoji: '📅', exacta: false },
  ];

  salir(): void {
    this.sesion.cerrarSesion();
  }
}
