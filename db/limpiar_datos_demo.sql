-- ============================================================================
-- Borra los datos de demostración creados al probar el dashboard localmente.
--
-- SOLO PARA LA BASE DE DESARROLLO. Ejecutar con:
--   psql -d seis_mas -f db/limpiar_datos_demo.sql
--
-- El borrado va en cascada desde comercios y usuarios, así que arrastra los
-- menús, secciones, ítems, propuestas, anfitriones y eventos asociados.
-- ============================================================================

BEGIN;

-- Comercios de prueba (y todo lo que cuelga de ellos por ON DELETE CASCADE)
DELETE FROM comercios WHERE email IN ('hola@botanico.co', 'intruso@bar.co');

-- Usuarios de prueba y su pertenencia a grupos
DELETE FROM usuarios WHERE email IN ('ana@test.co', 'carlos@test.co');

-- El grupo piloto queda sin miembros tras lo anterior
DELETE FROM grupos WHERE nombre = 'Grupo piloto';

COMMIT;

-- ============================================================================
-- Cuenta de demostración de la App Store (db/cuenta_demo_app_store.sql)
--
-- Va aparte y comentado a propósito: a diferencia del resto de este archivo,
-- esos datos viven en PRODUCCIÓN y son lo que ve el revisor de Apple. Borrarlos
-- mientras hay una versión en revisión es un rechazo por guideline 2.1.
-- Descomentar solo cuando la app ya no esté en revisión.
--
-- El borrado va en cascada: usuarios arrastra sus tests, intereses, membresías
-- y valoraciones; comercios arrastra anfitriones y eventos.
-- ============================================================================

-- BEGIN;
-- DELETE FROM comercios WHERE id = 'ded00000-0000-4000-8000-000000000020';
-- DELETE FROM grupos    WHERE id = 'ded00000-0000-4000-8000-000000000010';
-- DELETE FROM usuarios  WHERE id IN (
--   'ded00000-0000-4000-8000-000000000001','ded00000-0000-4000-8000-000000000002',
--   'ded00000-0000-4000-8000-000000000003','ded00000-0000-4000-8000-000000000004',
--   'ded00000-0000-4000-8000-000000000005','ded00000-0000-4000-8000-000000000006');
-- COMMIT;
