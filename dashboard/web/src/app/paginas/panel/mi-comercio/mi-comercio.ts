/**
 * Edición del perfil del comercio.
 *
 * Es lo que la app le muestra al usuario para saber a dónde va, así que el
 * microcopy insiste en el punto de vista de quien va a llegar.
 */

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../../core/api.service';
import { SesionService } from '../../../core/sesion.service';
import { mensajeDeError } from '../../../core/errores';

@Component({
  selector: 'panel-mi-comercio',
  imports: [ReactiveFormsModule],
  templateUrl: './mi-comercio.html',
})
export class MiComercio {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private sesion = inject(SesionService);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly guardado = signal(false);
  readonly email = signal('');

  readonly categorias = ['Restaurante', 'Café', 'Bar', 'Cervecería', 'Panadería', 'Espacio cultural', 'Otro'];

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    categoria: [''],
    telefono: [''],
    ciudad: [''],
    direccion: [''],
    nit: [''],
    sitio_web: [''],
    horario: [''],
    descripcion: [''],
  });

  constructor() {
    this.api.miComercio().subscribe({
      next: (comercio) => {
        this.email.set(comercio.email);
        this.formulario.patchValue({
          nombre: comercio.nombre,
          categoria: comercio.categoria ?? '',
          telefono: comercio.telefono ?? '',
          ciudad: comercio.ciudad ?? '',
          direccion: comercio.direccion ?? '',
          nit: comercio.nit ?? '',
          sitio_web: comercio.sitio_web ?? '',
          horario: comercio.horario ?? '',
          descripcion: comercio.descripcion ?? '',
        });
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.guardado.set(false);

    this.api.actualizarComercio(this.formulario.getRawValue()).subscribe({
      next: (comercio) => {
        // Se refresca la sesión para que el nombre del menú lateral cambie al
        // instante y no en la próxima recarga.
        this.sesion.actualizarComercio(comercio);
        this.guardando.set(false);
        this.guardado.set(true);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.guardando.set(false);
      },
    });
  }

  falla(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }
}
