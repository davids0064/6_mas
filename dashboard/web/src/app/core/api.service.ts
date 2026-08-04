/**
 * Cliente de la API del dashboard.
 *
 * Un solo servicio para todos los recursos: son endpoints CRUD sobre el mismo
 * contexto y partirlo en seis servicios solo agregaría archivos. El token lo
 * pone el interceptor, así que aquí no aparece autenticación por ningún lado.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../environments/environment';
import {
  Anfitrion,
  Comercio,
  Evento,
  Franja,
  Interes,
  MenuCompleto,
  MenuItem,
  MenuResumen,
  MenuSeccion,
  Plan,
  Propuesta,
  RespuestaAsistentes,
  Resumen,
} from './modelos';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // --- Resumen y perfil ---
  resumen() {
    return this.http.get<Resumen>(`${this.base}/resumen`);
  }

  miComercio() {
    return this.http.get<Comercio>(`${this.base}/mi-comercio`);
  }

  actualizarComercio(datos: Partial<Comercio>) {
    return this.http.put<Comercio>(`${this.base}/mi-comercio`, datos);
  }

  // --- Menús ---
  menus() {
    return this.http.get<MenuResumen[]>(`${this.base}/menus`);
  }

  menu(id: string) {
    return this.http.get<MenuCompleto>(`${this.base}/menus/${id}`);
  }

  crearMenu(datos: Partial<MenuResumen>) {
    return this.http.post<MenuResumen>(`${this.base}/menus`, datos);
  }

  actualizarMenu(id: string, datos: Partial<MenuResumen>) {
    return this.http.put<MenuResumen>(`${this.base}/menus/${id}`, datos);
  }

  eliminarMenu(id: string) {
    return this.http.delete<void>(`${this.base}/menus/${id}`);
  }

  // --- Secciones ---
  crearSeccion(menuId: string, datos: Partial<MenuSeccion>) {
    return this.http.post<MenuSeccion>(`${this.base}/menus/${menuId}/secciones`, datos);
  }

  actualizarSeccion(id: string, datos: Partial<MenuSeccion>) {
    return this.http.put<MenuSeccion>(`${this.base}/secciones/${id}`, datos);
  }

  eliminarSeccion(id: string) {
    return this.http.delete<void>(`${this.base}/secciones/${id}`);
  }

  // --- Ítems ---
  crearItem(seccionId: string, datos: Partial<MenuItem>) {
    return this.http.post<MenuItem>(`${this.base}/secciones/${seccionId}/items`, datos);
  }

  actualizarItem(id: string, datos: Partial<MenuItem>) {
    return this.http.put<MenuItem>(`${this.base}/items/${id}`, datos);
  }

  eliminarItem(id: string) {
    return this.http.delete<void>(`${this.base}/items/${id}`);
  }

  // --- Propuestas de bienvenida ---
  propuestas() {
    return this.http.get<Propuesta[]>(`${this.base}/propuestas`);
  }

  crearPropuesta(datos: Partial<Propuesta>) {
    return this.http.post<Propuesta>(`${this.base}/propuestas`, datos);
  }

  actualizarPropuesta(id: string, datos: Partial<Propuesta>) {
    return this.http.put<Propuesta>(`${this.base}/propuestas/${id}`, datos);
  }

  eliminarPropuesta(id: string) {
    return this.http.delete<void>(`${this.base}/propuestas/${id}`);
  }

  // --- Oferta: planes y disponibilidad ---
  // Es lo que hace competir al comercio por un grupo. El matching necesita las
  // dos cosas: con planes pero sin franjas (o al revés) el comercio es
  // invisible para el algoritmo.

  /** Catálogo de categorías, para el selector al crear un plan. */
  intereses() {
    return this.http.get<Interes[]>(`${this.base}/intereses`);
  }

  planes() {
    return this.http.get<Plan[]>(`${this.base}/planes`);
  }

  crearPlan(datos: Partial<Plan>) {
    return this.http.post<Plan>(`${this.base}/planes`, datos);
  }

  actualizarPlan(id: string, datos: Partial<Plan>) {
    return this.http.put<Plan>(`${this.base}/planes/${id}`, datos);
  }

  eliminarPlan(id: string) {
    return this.http.delete<void>(`${this.base}/planes/${id}`);
  }

  disponibilidad() {
    return this.http.get<Franja[]>(`${this.base}/disponibilidad`);
  }

  crearFranja(datos: Partial<Franja>) {
    return this.http.post<Franja>(`${this.base}/disponibilidad`, datos);
  }

  actualizarFranja(id: string, datos: Partial<Franja>) {
    return this.http.put<Franja>(`${this.base}/disponibilidad/${id}`, datos);
  }

  eliminarFranja(id: string) {
    return this.http.delete<void>(`${this.base}/disponibilidad/${id}`);
  }

  // --- Anfitriones ---
  anfitriones() {
    return this.http.get<Anfitrion[]>(`${this.base}/anfitriones`);
  }

  crearAnfitrion(datos: Partial<Anfitrion>) {
    return this.http.post<Anfitrion>(`${this.base}/anfitriones`, datos);
  }

  actualizarAnfitrion(id: string, datos: Partial<Anfitrion>) {
    return this.http.put<Anfitrion>(`${this.base}/anfitriones/${id}`, datos);
  }

  eliminarAnfitrion(id: string) {
    return this.http.delete<void>(`${this.base}/anfitriones/${id}`);
  }

  // --- Eventos ---
  eventos(filtros?: { estado?: string; desde?: string }) {
    const qs = new URLSearchParams();
    if (filtros?.estado) qs.set('estado', filtros.estado);
    if (filtros?.desde) qs.set('desde', filtros.desde);
    const sufijo = qs.toString() ? `?${qs}` : '';
    return this.http.get<Evento[]>(`${this.base}/eventos${sufijo}`);
  }

  crearEvento(datos: Partial<Evento>) {
    return this.http.post<Evento>(`${this.base}/eventos`, datos);
  }

  actualizarEvento(id: string, datos: Partial<Evento>) {
    return this.http.put<Evento>(`${this.base}/eventos/${id}`, datos);
  }

  eliminarEvento(id: string) {
    return this.http.delete<void>(`${this.base}/eventos/${id}`);
  }

  /** Quiénes vienen al evento: nombre de pila e intereses, nada más. */
  asistentes(eventoId: string) {
    return this.http.get<RespuestaAsistentes>(`${this.base}/eventos/${eventoId}/asistentes`);
  }
}
