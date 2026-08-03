/**
 * Inicio de sesión del comercio.
 */

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { SesionService } from '../../core/sesion.service';
import { mensajeDeError } from '../../core/errores';

@Component({
  selector: 'pagina-entrar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './entrar.html',
  styleUrls: ['../acceso.css'],
})
export class Entrar {
  private fb = inject(FormBuilder);
  private sesion = inject(SesionService);
  private router = inject(Router);

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  entrar(): void {
    // markAllAsTouched hace visibles los errores de los campos que el usuario
    // ni siquiera tocó: el segundo momento de validación del patrón del móvil.
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { email, password } = this.formulario.getRawValue();
    this.sesion.iniciarSesion(email, password).subscribe({
      next: () => this.router.navigate(['/panel']),
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  /** Un campo se marca en rojo solo si ya fue tocado: no se regaña por adelantado. */
  falla(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }
}
