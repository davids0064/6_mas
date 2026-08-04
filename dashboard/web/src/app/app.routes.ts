/**
 * Rutas del dashboard.
 *
 * Dos zonas: la pública (inicio, entrar, registro) y el panel, protegido por
 * guardSesion. Todo se carga con loadComponent para que quien solo visita la
 * página de inicio no descargue el código del panel.
 */

import { Routes } from '@angular/router';

import { guardInvitado, guardSesion } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
    title: 'Seis Más para comercios',
  },
  {
    path: 'entrar',
    canActivate: [guardInvitado],
    loadComponent: () => import('./paginas/entrar/entrar').then((m) => m.Entrar),
    title: 'Iniciar sesión — Seis Más',
  },
  {
    path: 'registro',
    canActivate: [guardInvitado],
    loadComponent: () => import('./paginas/registro/registro').then((m) => m.Registro),
    title: 'Registra tu comercio — Seis Más',
  },
  {
    path: 'panel',
    canActivate: [guardSesion],
    loadComponent: () => import('./paginas/panel/panel').then((m) => m.Panel),
    children: [
      {
        path: '',
        loadComponent: () => import('./paginas/panel/resumen/resumen').then((m) => m.ResumenPagina),
        title: 'Inicio — Seis Más',
      },
      {
        path: 'mi-comercio',
        loadComponent: () => import('./paginas/panel/mi-comercio/mi-comercio').then((m) => m.MiComercio),
        title: 'Mi comercio — Seis Más',
      },
      {
        path: 'menus',
        loadComponent: () => import('./paginas/panel/menus/menus').then((m) => m.Menus),
        title: 'Menús — Seis Más',
      },
      {
        path: 'menus/:id',
        loadComponent: () => import('./paginas/panel/menus/menu-editor').then((m) => m.MenuEditor),
        title: 'Editar menú — Seis Más',
      },
      {
        path: 'oferta',
        loadComponent: () => import('./paginas/panel/oferta/oferta').then((m) => m.Oferta),
        title: 'Tu oferta — Seis Más',
      },
      {
        path: 'propuestas',
        loadComponent: () => import('./paginas/panel/propuestas/propuestas').then((m) => m.Propuestas),
        title: 'Propuestas de bienvenida — Seis Más',
      },
      {
        path: 'anfitriones',
        loadComponent: () => import('./paginas/panel/anfitriones/anfitriones').then((m) => m.Anfitriones),
        title: 'Anfitriones — Seis Más',
      },
      {
        path: 'eventos',
        loadComponent: () => import('./paginas/panel/eventos/eventos').then((m) => m.Eventos),
        title: 'Eventos — Seis Más',
      },
    ],
  },
  // Cualquier ruta desconocida vuelve al inicio en vez de dejar una pantalla
  // en blanco.
  { path: '**', redirectTo: '' },
];
