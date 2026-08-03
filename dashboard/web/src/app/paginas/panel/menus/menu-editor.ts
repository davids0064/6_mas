/**
 * Editor de un menú: secciones e ítems.
 *
 * Las escrituras se aplican primero en pantalla y luego se confirman contra el
 * servidor (actualización optimista). Marcar un plato como agotado en plena
 * hora pico no debe hacer parpadear la carta entera esperando una respuesta;
 * si falla, se recarga el menú y se muestra el error.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api.service';
import { EstadoMenu, MenuCompleto, MenuItem, MenuSeccion } from '../../../core/modelos';
import { mensajeDeError } from '../../../core/errores';

/** Borrador del formulario de ítem, antes de mandarlo a la API. */
interface BorradorItem {
  nombre: string;
  descripcion: string;
  precio: number | null;
}

@Component({
  selector: 'panel-menu-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './menu-editor.html',
})
export class MenuEditor {
  private api = inject(ApiService);
  private ruta = inject(ActivatedRoute);

  private readonly menuId = this.ruta.snapshot.paramMap.get('id')!;

  readonly menu = signal<MenuCompleto | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Sección cuyo formulario de "agregar plato" está abierto. */
  readonly seccionEnEdicion = signal<string | null>(null);
  readonly nuevaSeccionAbierta = signal(false);

  nombreSeccion = '';
  borrador: BorradorItem = { nombre: '', descripcion: '', precio: null };

  readonly totalPlatos = computed(
    () => this.menu()?.secciones.reduce((suma, s) => suma + s.items.length, 0) ?? 0,
  );

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.menu(this.menuId).subscribe({
      next: (menu) => {
        this.menu.set(menu);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  // --- Menú ---

  cambiarEstado(estado: EstadoMenu): void {
    this.api.actualizarMenu(this.menuId, { estado }).subscribe({
      next: () => this.menu.update((m) => (m ? { ...m, estado } : m)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  // --- Secciones ---

  agregarSeccion(): void {
    const nombre = this.nombreSeccion.trim();
    if (!nombre) return;

    // El orden se calcula en el cliente para que las secciones nuevas caigan
    // al final; reordenarlas es una funcionalidad aparte.
    const orden = (this.menu()?.secciones.length ?? 0) + 1;

    this.api.crearSeccion(this.menuId, { nombre, orden }).subscribe({
      next: (seccion) => {
        this.menu.update((m) =>
          m ? { ...m, secciones: [...m.secciones, { ...seccion, items: [] }] } : m,
        );
        this.nombreSeccion = '';
        this.nuevaSeccionAbierta.set(false);
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  eliminarSeccion(seccion: MenuSeccion): void {
    const aviso =
      seccion.items.length > 0
        ? `¿Eliminar "${seccion.nombre}" y sus ${seccion.items.length} platos?`
        : `¿Eliminar la sección "${seccion.nombre}"?`;
    if (!confirm(aviso)) return;

    this.api.eliminarSeccion(seccion.id).subscribe({
      next: () =>
        this.menu.update((m) =>
          m ? { ...m, secciones: m.secciones.filter((s) => s.id !== seccion.id) } : m,
        ),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  // --- Ítems ---

  abrirFormularioItem(seccionId: string): void {
    this.borrador = { nombre: '', descripcion: '', precio: null };
    this.seccionEnEdicion.set(seccionId);
  }

  agregarItem(seccionId: string): void {
    const nombre = this.borrador.nombre.trim();
    if (!nombre) return;

    this.api
      .crearItem(seccionId, {
        nombre,
        descripcion: this.borrador.descripcion.trim() || null,
        precio: this.borrador.precio ?? 0,
      })
      .subscribe({
        next: (item) => {
          this.menu.update((m) =>
            m
              ? {
                  ...m,
                  secciones: m.secciones.map((s) =>
                    s.id === seccionId ? { ...s, items: [...s.items, item] } : s,
                  ),
                }
              : m,
          );
          this.borrador = { nombre: '', descripcion: '', precio: null };
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }

  alternarDisponible(seccionId: string, item: MenuItem): void {
    const disponible = !item.disponible;

    // Optimista: el interruptor responde al instante.
    this.actualizarItemLocal(seccionId, { ...item, disponible });

    this.api.actualizarItem(item.id, { disponible }).subscribe({
      error: (e) => {
        this.actualizarItemLocal(seccionId, item); // revierte
        this.error.set(mensajeDeError(e));
      },
    });
  }

  eliminarItem(seccionId: string, item: MenuItem): void {
    if (!confirm(`¿Eliminar "${item.nombre}" del menú?`)) return;

    this.api.eliminarItem(item.id).subscribe({
      next: () =>
        this.menu.update((m) =>
          m
            ? {
                ...m,
                secciones: m.secciones.map((s) =>
                  s.id === seccionId ? { ...s, items: s.items.filter((i) => i.id !== item.id) } : s,
                ),
              }
            : m,
        ),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private actualizarItemLocal(seccionId: string, item: MenuItem): void {
    this.menu.update((m) =>
      m
        ? {
            ...m,
            secciones: m.secciones.map((s) =>
              s.id === seccionId
                ? { ...s, items: s.items.map((i) => (i.id === item.id ? item : i)) }
                : s,
            ),
          }
        : m,
    );
  }
}
