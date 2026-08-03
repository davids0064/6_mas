/**
 * Sesión del comercio: token, datos y estado reactivo.
 *
 * Sobre dónde vive el token: al estar el frontend en un dominio y la API en
 * otro, una cookie HttpOnly compartida no es viable sin complicar el
 * despliegue, así que el token va en localStorage. Eso lo expone a XSS, y se
 * compensa con tokens de vida corta (8h) y sin datos sensibles dentro: el
 * payload solo lleva comercio_id y email.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { Comercio, RespuestaSesion } from './modelos';

const CLAVE_TOKEN = 'seismas_token';
const CLAVE_COMERCIO = 'seismas_comercio';

@Injectable({ providedIn: 'root' })
export class SesionService {
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Signals para que la plantilla reaccione sin subscripciones manuales. */
  private _token = signal<string | null>(this.leerToken());
  private _comercio = signal<Comercio | null>(this.leerComercio());

  readonly comercio = this._comercio.asReadonly();
  readonly autenticado = computed(() => this._token() !== null);

  iniciarSesion(email: string, password: string) {
    return this.http
      .post<RespuestaSesion>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((r) => this.guardar(r)));
  }

  registrar(datos: Record<string, unknown>) {
    return this.http
      .post<RespuestaSesion>(`${environment.apiUrl}/auth/registro`, datos)
      .pipe(tap((r) => this.guardar(r)));
  }

  cerrarSesion(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_COMERCIO);
    this._token.set(null);
    this._comercio.set(null);
    this.router.navigate(['/entrar']);
  }

  token(): string | null {
    return this._token();
  }

  /** Refresca los datos en memoria tras editar el perfil. */
  actualizarComercio(comercio: Comercio): void {
    localStorage.setItem(CLAVE_COMERCIO, JSON.stringify(comercio));
    this._comercio.set(comercio);
  }

  private guardar(r: RespuestaSesion): void {
    localStorage.setItem(CLAVE_TOKEN, r.token);
    localStorage.setItem(CLAVE_COMERCIO, JSON.stringify(r.comercio));
    this._token.set(r.token);
    this._comercio.set(r.comercio);
  }

  private leerToken(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  private leerComercio(): Comercio | null {
    const crudo = localStorage.getItem(CLAVE_COMERCIO);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo) as Comercio;
    } catch {
      // localStorage corrupto o de una versión anterior: se descarta en vez
      // de dejar la app en un estado imposible de recuperar sin devtools.
      localStorage.removeItem(CLAVE_COMERCIO);
      return null;
    }
  }
}
