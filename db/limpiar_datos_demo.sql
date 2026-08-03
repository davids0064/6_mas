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
