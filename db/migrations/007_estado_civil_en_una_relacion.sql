-- ============================================================================
-- 007 — "En una relación" en la pregunta de estado civil.
--
-- Faltaba: entre "Soltero infeliz" y "Casado" hay mucha gente, y hasta ahora
-- tenía que elegir una de las dos cosas que no era.
--
-- POR QUÉ ESTO ES UNA MIGRACIÓN Y NO UN INSERT SUELTO. Desde la 006 el
-- cuestionario se puede editar con SQL directo, y para probar un enunciado o
-- reordenar opciones eso está bien. Pero un cambio permanente de producto que
-- solo viva en la base de producción deja a cualquier entorno nuevo —el local
-- de quien entre al equipo, una base de pruebas— con un cuestionario distinto,
-- y esa diferencia no la ve nadie hasta que confunde a alguien. Acá queda
-- auditable y se replica solo.
--
-- `estado_civil` es una de las siete preguntas libres: el backend solo compara
-- igualdad entre dos personas, así que añadir una opción no toca el perfil ni
-- los ejes. Con una de las trece acopladas, esto no sería un INSERT y ya
-- (ver services/cuestionario.js).
--
-- Es idempotente: se puede correr dos veces sin duplicar nada.
-- ============================================================================

BEGIN;

-- Se fija el orden COMPLETO de la pregunta en vez de abrir un hueco corriendo
-- las de abajo. El primer intento hacía `orden = orden + 1` para las que van
-- después de la tercera, y eso vuelve a correrlas en cada pasada: el orden
-- visible queda bien, pero los números crecen (4,5,6 → 5,6,7 → 6,7,8) y la
-- migración deja de ser reproducible. Declarar las seis posiciones da el mismo
-- resultado se ejecute una vez o veinte.
INSERT INTO pa_test_opciones (pregunta_clave, valor, texto, orden) VALUES
    ('estado_civil', 'soltero_feliz',   'Soltero feliz',   1),
    ('estado_civil', 'soltero_infeliz', 'Soltero infeliz', 2),
    ('estado_civil', 'en_relacion',     'En una relación', 3),
    ('estado_civil', 'casado',          'Casado',          4),
    ('estado_civil', 'divorciado',      'Divorciado',      5),
    ('estado_civil', 'viudo',           'Viudo',           6)
ON CONFLICT (pregunta_clave, valor) DO UPDATE
   SET texto = EXCLUDED.texto, orden = EXCLUDED.orden, activo = TRUE;

COMMIT;

-- --- Verificación -----------------------------------------------------------
SELECT orden, valor, texto
  FROM pa_test_opciones
 WHERE pregunta_clave = 'estado_civil' AND activo
 ORDER BY orden;
