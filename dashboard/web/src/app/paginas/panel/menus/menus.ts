/**
 * Listado de menús. El detalle (secciones e ítems) vive en MenuEditor.
 */

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api.service';
import { EstadoMenu, MenuResumen } from '../../../core/modelos';
import { mensajeDeError } from '../../../core/errores';

@Component({
  selector: 'panel-menus',
  imports: [RouterLink, FormsModule],
  templateUrl: './menus.html',
})
export class Menus {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly menus = signal<MenuResumen[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly modalAbierto = signal(false);
  readonly creando = signal(false);
  nombreNuevo = '';
  descripcionNueva = '';

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.menus().subscribe({
      next: (menus) => {
        this.menus.set(menus);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  abrirModal(): void {
    this.nombreNuevo = '';
    this.descripcionNueva = '';
    this.modalAbierto.set(true);
  }

  crear(): void {
    if (!this.nombreNuevo.trim()) return;

    this.creando.set(true);
    this.api
      .crearMenu({ nombre: this.nombreNuevo.trim(), descripcion: this.descripcionNueva.trim() || null })
      .subscribe({
        next: (menu) => {
          this.creando.set(false);
          this.modalAbierto.set(false);
          // Se entra directo al editor: crear un menú vacío y quedarse en la
          // lista obligaría a un clic más para hacer lo único que tiene
          // sentido a continuación.
          this.router.navigate(['/panel/menus', menu.id]);
        },
        error: (e) => {
          this.error.set(mensajeDeError(e));
          this.creando.set(false);
        },
      });
  }

  cambiarEstado(menu: MenuResumen, estado: EstadoMenu): void {
    this.api.actualizarMenu(menu.id, { estado }).subscribe({
      next: () => this.menus.update((lista) => lista.map((m) => (m.id === menu.id ? { ...m, estado } : m))),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  eliminar(menu: MenuResumen): void {
    if (!confirm(`¿Eliminar el menú "${menu.nombre}"? Esta acción no se puede deshacer.`)) return;

    this.api.eliminarMenu(menu.id).subscribe({
      next: () => this.menus.update((lista) => lista.filter((m) => m.id !== menu.id)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  claseEstado(estado: EstadoMenu): string {
    if (estado === 'publicado') return 'chip chip-exito';
    if (estado === 'borrador') return 'chip chip-alerta';
    return 'chip chip-neutro';
  }
}
