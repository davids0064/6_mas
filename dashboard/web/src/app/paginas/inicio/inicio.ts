/**
 * Página de inicio pública — la cara de venta hacia el comercio.
 *
 * Retoma la composición de WelcomeAnimationScreen del móvil: fondo índigo
 * profundo (el cielo de la ilustración de marca), logo, lema y un único CTA
 * naranja. La diferencia de audiencia manda en el texto: aquí no se le habla
 * a alguien que quiere conocer gente, sino a un negocio que quiere llenar
 * mesas entre semana.
 */

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pagina-inicio',
  imports: [RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  readonly pasos = [
    {
      emoji: '🏪',
      titulo: 'Registra tu comercio',
      texto: 'Cuéntanos dónde estás, qué ofreces y quién va a recibir a los grupos.',
    },
    {
      emoji: '📖',
      titulo: 'Publica tu menú',
      texto: 'Arma tu carta por secciones. Cámbiala cuando quieras, sin intermediarios.',
    },
    {
      emoji: '🎁',
      titulo: 'Crea tu propuesta de bienvenida',
      texto: 'La experiencia con la que recibes al grupo: qué incluye, cuánto dura, cuánto cuesta.',
    },
    {
      emoji: '👥',
      titulo: 'Recibe grupos de seis',
      texto: 'Te contamos quiénes vienen y qué les gusta, para que la mesa esté lista.',
    },
  ];

  readonly beneficios = [
    {
      emoji: '📅',
      titulo: 'Llena las noches tranquilas',
      texto: 'Los grupos de Seis Más buscan planes entre semana, justo cuando tu local respira.',
    },
    {
      emoji: '✨',
      titulo: 'Grupos que ya se llevan bien',
      texto: 'Las personas llegan emparejadas por intereses. La conversación no la tienes que armar tú.',
    },
    {
      emoji: '🔒',
      titulo: 'Datos personales protegidos',
      texto: 'Ves el nombre y los gustos de quienes vienen. Nada más, y así debe ser.',
    },
  ];
}
