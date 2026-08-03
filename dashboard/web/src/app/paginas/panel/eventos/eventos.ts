/**
 * Eventos del comercio y quiénes asisten.
 *
 * Es la única pantalla que cruza la frontera hacia el mundo social, y lo hace
 * con lo mínimo: nombre de pila e intereses. No es una limitación de esta
 * pantalla sino del rol de base de datos con el que corre la API — pedir más
 * daría un error de permisos, no más datos.
 */

import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api.service';
import { Anfitrion, Asistente, Evento, EstadoEvento } from '../../../core/modelos';
import { mensajeDeError } from '../../../core/errores';

@Component({
  selector: 'panel-eventos',
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
  templateUrl: './eventos.html',
})
export class Eventos {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly eventos = signal<Evento[]>([]);
  readonly anfitriones = signal<Anfitrion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly modalAbierto = signal(false);

  /** Evento cuyo panel de asistentes está abierto. */
  readonly viendoAsistentes = signal<string | null>(null);
  readonly asistentes = signal<Asistente[]>([]);
  readonly cargandoAsistentes = signal(false);
  readonly sinGrupo = signal(false);

  readonly estados: EstadoEvento[] = ['propuesto', 'confirmado', 'en_curso', 'finalizado', 'cancelado'];

  readonly formulario = this.fb.nonNullable.group({
    titulo: ['', [Validators.required]],
    anfitrion_id: ['', [Validators.required]],
    fecha_hora: ['', [Validators.required]],
    descripcion: [''],
    categoria: [''],
    capacidad: [6, [Validators.min(1)]],
    precio: [0, [Validators.min(0)]],
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.eventos().subscribe({
      next: (eventos) => {
        this.eventos.set(eventos);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });

    // Los anfitriones se cargan siempre: el formulario de evento los necesita
    // y sirven para explicar por qué no se puede crear uno si no hay ninguno.
    this.api.anfitriones().subscribe({
      next: (anfitriones) => this.anfitriones.set(anfitriones),
      error: () => {
        /* No es crítico: el aviso de "sin anfitriones" cubre el caso. */
      },
    });
  }

  nuevo(): void {
    const titular = this.anfitriones().find((a) => a.titular) ?? this.anfitriones()[0];
    this.formulario.reset({
      titulo: '',
      anfitrion_id: titular?.id ?? '',
      fecha_hora: '',
      descripcion: '',
      categoria: '',
      capacidad: 6,
      precio: 0,
    });
    this.modalAbierto.set(true);
  }

  crear(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    this.guardando.set(true);
    this.error.set(null);

    this.api
      .crearEvento({
        titulo: valores.titulo,
        anfitrion_id: valores.anfitrion_id,
        // datetime-local entrega 'YYYY-MM-DDTHH:mm' sin zona; Postgres lo
        // interpreta en la zona del servidor, que es la del comercio.
        fecha_hora: valores.fecha_hora,
        descripcion: valores.descripcion || null,
        categoria: valores.categoria || null,
        capacidad: valores.capacidad,
        precio: valores.precio,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalAbierto.set(false);
          this.cargar();
        },
        error: (e) => {
          this.error.set(mensajeDeError(e));
          this.guardando.set(false);
        },
      });
  }

  cambiarEstado(evento: Evento, estado: EstadoEvento): void {
    this.api.actualizarEvento(evento.id, { estado }).subscribe({
      next: (actualizado) =>
        this.eventos.update((lista) => lista.map((e) => (e.id === evento.id ? actualizado : e))),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  cancelar(evento: Evento): void {
    if (!confirm(`¿Cancelar el evento "${evento.titulo}"?`)) return;

    this.api.eliminarEvento(evento.id).subscribe({
      next: () => this.eventos.update((lista) => lista.filter((e) => e.id !== evento.id)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  verAsistentes(evento: Evento): void {
    // Segundo clic sobre el mismo evento cierra el panel.
    if (this.viendoAsistentes() === evento.id) {
      this.viendoAsistentes.set(null);
      return;
    }

    this.viendoAsistentes.set(evento.id);
    this.cargandoAsistentes.set(true);
    this.asistentes.set([]);
    this.sinGrupo.set(false);

    this.api.asistentes(evento.id).subscribe({
      next: (respuesta) => {
        this.sinGrupo.set(!respuesta.grupo_asignado);
        this.asistentes.set(respuesta.asistentes);
        this.cargandoAsistentes.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargandoAsistentes.set(false);
      },
    });
  }

  claseEstado(estado: EstadoEvento): string {
    if (estado === 'confirmado' || estado === 'finalizado') return 'chip chip-exito';
    if (estado === 'cancelado') return 'chip chip-neutro';
    return 'chip chip-alerta';
  }

  falla(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }
}
