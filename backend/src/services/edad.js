// Cálculo de edad a partir de una fecha de nacimiento.
//
// Vive en su propio módulo, y no dentro de la ruta de registro, por una razón
// práctica: la mayoría de edad es el requisito que sostiene la clasificación
// por edad de la ficha de la App Store y la responsabilidad de quien sienta a
// seis desconocidos en una mesa. Un cálculo así no puede ir sin pruebas, y
// aquí es puro — sin base de datos ni servidor — así que se prueba en
// milisegundos (tests/edad.test.js).
'use strict';

// Edad cumplida a una fecha de referencia (hoy por defecto). Devuelve null si
// la fecha no es interpretable o es futura, para que quien llama distinga
// "dato inválido" de "menor de edad": son dos errores distintos y merecen
// mensajes distintos.
function edadEnAnios(fechaNacimiento, referencia = new Date()) {
  const nacimiento =
    fechaNacimiento instanceof Date ? fechaNacimiento : new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  if (nacimiento > referencia) return null;

  let edad = referencia.getUTCFullYear() - nacimiento.getUTCFullYear();
  // Resta un año si todavía no llegó el cumpleaños. Comparar mes y día por
  // separado evita el error clásico de dar por cumplido un cumpleaños que aún
  // no ocurrió — el que hace que alguien de 17 años y 11 meses figure como 18.
  const mes = referencia.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && referencia.getUTCDate() < nacimiento.getUTCDate())) {
    edad -= 1;
  }
  return edad;
}

const EDAD_MINIMA = 18;

module.exports = { edadEnAnios, EDAD_MINIMA };
