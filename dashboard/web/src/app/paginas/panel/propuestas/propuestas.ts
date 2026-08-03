/**
 * Propuestas de bienvenida.
 *
 * El campo "incluye" se edita como una línea por elemento en un textarea, en
 * vez de una lista dinámica de inputs: escribir cuatro viñetas seguidas es más
 * rápido que hacer clic en "+" cuatro veces, y en la base sigue siendo un
 * arreglo bien formado.
 */

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../../core/api.service';
import { Propuesta } from '../../../core/modelos';
import { mensajeDeError } from '../../../core/errores';

@Component({
  selector: 'panel-propuestas',
  imports: [ReactiveFormsModule],
  templateUrl: './propuestas.html',
})
export class Propuestas {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly propuestas = signal<Propuesta[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  /** null = modal cerrado; '' = creando; un id = editando esa propuesta. */
  readonly editando = signal<string | null>(null);
  readonly modalAbierto = signal(false);

  readonly formulario = this.fb.nonNullable.group({
    titulo: ['', [Validators.required]],
    descripcion: [''],
    incluye: [''],
    precio_persona: [0, [Validators.min(0)]],
    duracion_min: [null as number | null],
    activa: [true],
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.propuestas().subscribe({
      next: (propuestas) => {
        this.propuestas.set(propuestas);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  nueva(): void {
    this.formulario.reset({ titulo: '', descripcion: '', incluye: '', precio_persona: 0, duracion_min: null, activa: true });
    this.editando.set('');
    this.modalAbierto.set(true);
  }

  editar(propuesta: Propuesta): void {
    this.formulario.reset({
      titulo: propuesta.titulo,
      descripcion: propuesta.descripcion ?? '',
      incluye: propuesta.incluye.join('\n'),
      precio_persona: propuesta.precio_persona,
      duracion_min: propuesta.duracion_min,
      activa: propuesta.activa,
    });
    this.editando.set(propuesta.id);
    this.modalAbierto.set(true);
  }

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    const datos = {
      titulo: valores.titulo,
      descripcion: valores.descripcion || null,
      incluye: valores.incluye
        .split('\n')
        .map((linea) => linea.trim())
        .filter((linea) => linea !== ''),
      precio_persona: valores.precio_persona ?? 0,
      duracion_min: valores.duracion_min,
      activa: valores.activa,
    };

    this.guardando.set(true);
    this.error.set(null);

    const id = this.editando();
    const peticion = id
      ? this.api.actualizarPropuesta(id, datos)
      : this.api.crearPropuesta(datos);

    peticion.subscribe({
      next: (propuesta) => {
        this.propuestas.update((lista) =>
          id ? lista.map((p) => (p.id === id ? propuesta : p)) : [propuesta, ...lista],
        );
        this.guardando.set(false);
        this.modalAbierto.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.guardando.set(false);
      },
    });
  }

  alternarActiva(propuesta: Propuesta): void {
    const activa = !propuesta.activa;
    this.api.actualizarPropuesta(propuesta.id, { activa }).subscribe({
      next: (actualizada) =>
        this.propuestas.update((lista) => lista.map((p) => (p.id === propuesta.id ? actualizada : p))),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  eliminar(propuesta: Propuesta): void {
    if (!confirm(`¿Eliminar la propuesta "${propuesta.titulo}"?`)) return;

    this.api.eliminarPropuesta(propuesta.id).subscribe({
      next: () => this.propuestas.update((lista) => lista.filter((p) => p.id !== propuesta.id)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  falla(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }
}
