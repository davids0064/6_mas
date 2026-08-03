/**
 * Registro del comercio.
 *
 * Orden de campos con la misma lógica que RegistroScreen del móvil (ver
 * mobile/docs/GUIA_DISENO.md §2.2): primero lo automático de responder, al
 * final lo que exige esfuerzo. Aquí eso significa nombre y correo arriba,
 * contraseñas al final, y los datos del local en un bloque opcional en medio
 * — porque exigir el NIT antes de dejar entrar es la forma más rápida de
 * perder a un comercio que solo quería mirar.
 */

import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { SesionService } from '../../core/sesion.service';
import { mensajeDeError } from '../../core/errores';

/** Las dos contraseñas deben coincidir. Validador a nivel de grupo. */
function passwordsCoinciden(grupo: AbstractControl): ValidationErrors | null {
  const password = grupo.get('password')?.value;
  const confirmacion = grupo.get('confirmacion')?.value;
  return password && confirmacion && password !== confirmacion ? { noCoinciden: true } : null;
}

@Component({
  selector: 'pagina-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrls: ['../acceso.css'],
})
export class Registro {
  private fb = inject(FormBuilder);
  private sesion = inject(SesionService);
  private router = inject(Router);

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      categoria: [''],
      ciudad: [''],
      direccion: [''],
      nit: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmacion: ['', [Validators.required]],
    },
    { validators: passwordsCoinciden },
  );

  /** Categorías frecuentes; el campo admite cualquier texto igualmente. */
  readonly categorias = ['Restaurante', 'Café', 'Bar', 'Cervecería', 'Panadería', 'Espacio cultural', 'Otro'];

  registrar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { confirmacion, ...datos } = this.formulario.getRawValue();
    // Los opcionales vacíos se mandan como null y no como '': así la columna
    // queda NULL en la base y el resumen los detecta como pendientes.
    const carga = Object.fromEntries(
      Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]),
    );

    this.sesion.registrar(carga).subscribe({
      next: () => this.router.navigate(['/panel']),
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  falla(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }

  /** Borde verde + ✓ cuando el campo quedó bien, igual que en el móvil. */
  correcto(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.valid && control.touched && control.value !== '';
  }

  get passwordsNoCoinciden(): boolean {
    return (
      this.formulario.hasError('noCoinciden') &&
      !!this.formulario.get('confirmacion')?.touched
    );
  }
}
