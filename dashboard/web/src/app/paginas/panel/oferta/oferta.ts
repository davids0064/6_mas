/**
 * Oferta del comercio: sus planes y su disponibilidad.
 *
 * Las dos cosas viven en la misma página a propósito. Son las dos mitades de
 * lo mismo —qué ofreces y cuándo puedes recibir— y el matching necesita ambas:
 * con planes pero sin franjas, o al revés, el comercio no compite por ningún
 * grupo. Separarlas en dos secciones del menú haría fácil cargar una y creer
 * que ya está, que es exactamente el error que deja a un comercio preguntándose
 * por qué nunca le llega nadie.
 *
 * Por eso también el aviso de arriba: dice en una línea si el comercio está o
 * no compitiendo, y qué le falta para estarlo.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../../core/api.service';
import { Franja, Interes, Plan } from '../../../core/modelos';
import { mensajeDeError } from '../../../core/errores';

/** Índice = valor de dia_semana en la base (0 = domingo, como EXTRACT(DOW)). */
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

@Component({
  selector: 'panel-oferta',
  imports: [ReactiveFormsModule],
  templateUrl: './oferta.html',
})
export class Oferta {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly dias = DIAS.map((nombre, valor) => ({ valor, nombre }));

  readonly planes = signal<Plan[]>([]);
  readonly franjas = signal<Franja[]>([]);
  readonly intereses = signal<Interes[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  /** null = modal cerrado; '' = creando; un id = editando ese registro. */
  readonly editandoPlan = signal<string | null>(null);
  readonly editandoFranja = signal<string | null>(null);
  readonly modalPlan = signal(false);
  readonly modalFranja = signal(false);

  /**
   * Un comercio compite solo si tiene al menos un plan activo Y una franja
   * activa. Tener uno de los dos no sirve de nada, y es la confusión más cara
   * de esta pantalla, así que se calcula y se muestra explícitamente.
   */
  readonly planesActivos = computed(() => this.planes().filter((p) => p.activo).length);
  readonly franjasActivas = computed(() => this.franjas().filter((f) => f.activo).length);
  readonly compitiendo = computed(() => this.planesActivos() > 0 && this.franjasActivas() > 0);

  readonly queFalta = computed(() => {
    const sinPlanes = this.planesActivos() === 0;
    const sinFranjas = this.franjasActivas() === 0;
    if (sinPlanes && sinFranjas) return 'Te faltan un plan y un horario.';
    if (sinPlanes) return 'Tienes horarios, pero ningún plan activo que ofrecer.';
    if (sinFranjas) return 'Tienes planes, pero no has dicho cuándo puedes recibir.';
    return '';
  });

  /** Franjas agrupadas por día, para pintar la semana en orden. */
  readonly semana = computed(() =>
    this.dias.map((dia) => ({
      ...dia,
      franjas: this.franjas().filter((f) => f.dia_semana === dia.valor),
    })),
  );

  readonly formPlan = this.fb.nonNullable.group({
    titulo: ['', [Validators.required]],
    interes_id: ['', [Validators.required]],
    descripcion: [''],
    duracion_min: [120, [Validators.required, Validators.min(1)]],
    precio: [0, [Validators.min(0)]],
    // El mínimo es 6 porque los grupos de Seis Más siempre llegan completos.
    capacidad: [6, [Validators.required, Validators.min(6)]],
    activo: [true],
  });

  readonly formFranja = this.fb.nonNullable.group({
    dia_semana: [4, [Validators.required]],
    hora_inicio: ['19:00', [Validators.required]],
    hora_fin: ['22:00', [Validators.required]],
    grupos_max: [1, [Validators.required, Validators.min(1)]],
    activo: [true],
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.intereses().subscribe({
      next: (intereses) => this.intereses.set(intereses),
      error: (e) => this.error.set(mensajeDeError(e)),
    });

    this.api.planes().subscribe({
      next: (planes) => {
        this.planes.set(planes);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });

    this.api.disponibilidad().subscribe({
      next: (franjas) => this.franjas.set(franjas),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  // --- Planes ---

  nuevoPlan(): void {
    this.formPlan.reset({
      titulo: '',
      interes_id: '',
      descripcion: '',
      duracion_min: 120,
      precio: 0,
      capacidad: 6,
      activo: true,
    });
    this.error.set(null);
    this.editandoPlan.set('');
    this.modalPlan.set(true);
  }

  editarPlan(plan: Plan): void {
    this.formPlan.reset({
      titulo: plan.titulo,
      interes_id: plan.interes_id,
      descripcion: plan.descripcion ?? '',
      duracion_min: plan.duracion_min,
      precio: plan.precio,
      capacidad: plan.capacidad,
      activo: plan.activo,
    });
    this.error.set(null);
    this.editandoPlan.set(plan.id);
    this.modalPlan.set(true);
  }

  guardarPlan(): void {
    if (this.formPlan.invalid) {
      this.formPlan.markAllAsTouched();
      return;
    }

    const valores = this.formPlan.getRawValue();
    const datos = { ...valores, descripcion: valores.descripcion || null };

    this.guardando.set(true);
    this.error.set(null);

    const id = this.editandoPlan();
    const peticion = id ? this.api.actualizarPlan(id, datos) : this.api.crearPlan(datos);

    peticion.subscribe({
      next: (plan) => {
        this.planes.update((lista) =>
          id ? lista.map((p) => (p.id === id ? plan : p)) : [plan, ...lista],
        );
        this.guardando.set(false);
        this.modalPlan.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.guardando.set(false);
      },
    });
  }

  alternarPlan(plan: Plan): void {
    this.api.actualizarPlan(plan.id, { activo: !plan.activo }).subscribe({
      next: (actualizado) =>
        this.planes.update((lista) => lista.map((p) => (p.id === plan.id ? actualizado : p))),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  eliminarPlan(plan: Plan): void {
    if (!confirm(`¿Eliminar el plan "${plan.titulo}"?`)) return;

    this.api.eliminarPlan(plan.id).subscribe({
      next: () => this.planes.update((lista) => lista.filter((p) => p.id !== plan.id)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  // --- Disponibilidad ---

  nuevaFranja(dia?: number): void {
    this.formFranja.reset({
      dia_semana: dia ?? 4,
      hora_inicio: '19:00',
      hora_fin: '22:00',
      grupos_max: 1,
      activo: true,
    });
    this.error.set(null);
    this.editandoFranja.set('');
    this.modalFranja.set(true);
  }

  editarFranja(franja: Franja): void {
    this.formFranja.reset({
      dia_semana: franja.dia_semana,
      hora_inicio: franja.hora_inicio,
      hora_fin: franja.hora_fin,
      grupos_max: franja.grupos_max,
      activo: franja.activo,
    });
    this.error.set(null);
    this.editandoFranja.set(franja.id);
    this.modalFranja.set(true);
  }

  guardarFranja(): void {
    if (this.formFranja.invalid) {
      this.formFranja.markAllAsTouched();
      return;
    }

    const datos = this.formFranja.getRawValue();

    this.guardando.set(true);
    this.error.set(null);

    const id = this.editandoFranja();
    const peticion = id ? this.api.actualizarFranja(id, datos) : this.api.crearFranja(datos);

    peticion.subscribe({
      next: (franja) => {
        this.franjas.update((lista) => {
          const nueva = id ? lista.map((f) => (f.id === id ? franja : f)) : [...lista, franja];
          // Se reordena en cliente para que una franja nueva aparezca en su
          // sitio de la semana sin recargar la lista entera.
          return nueva.sort(
            (a, b) =>
              a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio),
          );
        });
        this.guardando.set(false);
        this.modalFranja.set(false);
      },
      error: (e) => {
        // El 409 de solape trae un mensaje útil ("ya tienes una franja el
        // jueves de 19:00 a 22:00"), así que se muestra tal cual.
        this.error.set(mensajeDeError(e));
        this.guardando.set(false);
      },
    });
  }

  alternarFranja(franja: Franja): void {
    this.api.actualizarFranja(franja.id, { activo: !franja.activo }).subscribe({
      next: (actualizada) =>
        this.franjas.update((lista) => lista.map((f) => (f.id === franja.id ? actualizada : f))),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  eliminarFranja(franja: Franja): void {
    if (!confirm(`¿Eliminar la franja del ${franja.dia_nombre} ${franja.hora_inicio}–${franja.hora_fin}?`)) {
      return;
    }

    this.api.eliminarFranja(franja.id).subscribe({
      next: () => this.franjas.update((lista) => lista.filter((f) => f.id !== franja.id)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  // --- Validación de formularios ---

  fallaPlan(campo: string): boolean {
    const control = this.formPlan.get(campo);
    return !!control && control.invalid && control.touched;
  }

  fallaFranja(campo: string): boolean {
    const control = this.formFranja.get(campo);
    return !!control && control.invalid && control.touched;
  }
}
