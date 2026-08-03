/**
 * Anfitriones: quién recibe a los grupos.
 *
 * Un comercio puede tener varios, pero solo uno es el titular — la cara que la
 * app le muestra al grupo. La base lo garantiza con un índice único parcial,
 * así que aquí no hace falta más que ofrecer el botón.
 */

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../../core/api.service';
import { Anfitrion } from '../../../core/modelos';
import { mensajeDeError } from '../../../core/errores';

@Component({
  selector: 'panel-anfitriones',
  imports: [ReactiveFormsModule],
  templateUrl: './anfitriones.html',
})
export class Anfitriones {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly anfitriones = signal<Anfitrion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly modalAbierto = signal(false);
  readonly editando = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    bio: [''],
    titular: [false],
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.anfitriones().subscribe({
      next: (anfitriones) => {
        this.anfitriones.set(anfitriones);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  nuevo(): void {
    // El primer anfitrión se propone como titular: es lo que el comercio va a
    // querer el 100% de las veces cuando no hay ninguno.
    const esPrimero = this.anfitriones().length === 0;
    this.formulario.reset({ nombre: '', email: '', telefono: '', bio: '', titular: esPrimero });
    this.editando.set(null);
    this.modalAbierto.set(true);
  }

  editar(anfitrion: Anfitrion): void {
    this.formulario.reset({
      nombre: anfitrion.nombre,
      email: anfitrion.email,
      telefono: anfitrion.telefono ?? '',
      bio: anfitrion.bio ?? '',
      titular: anfitrion.titular,
    });
    this.editando.set(anfitrion.id);
    this.modalAbierto.set(true);
  }

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    const datos = {
      nombre: valores.nombre,
      email: valores.email,
      telefono: valores.telefono || null,
      bio: valores.bio || null,
      titular: valores.titular,
    };

    this.guardando.set(true);
    this.error.set(null);

    const id = this.editando();
    const peticion = id ? this.api.actualizarAnfitrion(id, datos) : this.api.crearAnfitrion(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalAbierto.set(false);
        // Se recarga la lista completa en vez de parchear en memoria: al
        // cambiar de titular, OTRO anfitrión también cambió en el servidor.
        this.cargar();
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.guardando.set(false);
      },
    });
  }

  hacerTitular(anfitrion: Anfitrion): void {
    this.api.actualizarAnfitrion(anfitrion.id, { titular: true }).subscribe({
      next: () => this.cargar(),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  eliminar(anfitrion: Anfitrion): void {
    if (!confirm(`¿Eliminar a ${anfitrion.nombre} como anfitrión?`)) return;

    this.api.eliminarAnfitrion(anfitrion.id).subscribe({
      next: () => this.anfitriones.update((lista) => lista.filter((a) => a.id !== anfitrion.id)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  falla(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }
}
