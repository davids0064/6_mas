-- ============================================================================
-- 010 — Dar de alta y renovar una suscripción sin escribir SQL a mano.
--
-- El cobro va por transferencia y lo gestiona una persona. Esa persona, hoy,
-- tendría que escribir a mano un INSERT con el plan_id correcto, el cupo
-- congelado del tier, y las fechas del periodo calculadas — y si se equivoca en
-- cualquiera de los tres, el comercio recibe de más o de menos y nadie se da
-- cuenta hasta que reclama.
--
-- Esto no es automatizar el cobro: es que registrar un pago que ya ocurrió sea
-- una línea en vez de un formulario de cuatro campos donde uno es un UUID.
--
-- Qué resuelve sola:
--   * busca el plan_id por nombre, que es lo que la persona tiene en la cabeza
--   * congela el cupo del tier en el momento del alta
--   * encadena el periodo justo después del vigente si lo hay, para que
--     renovar no deje huecos ni solapes
--   * registra el pago en la misma transacción, si se le pasa el monto
-- ============================================================================

BEGIN;

-- DROP antes de crear: CREATE OR REPLACE no puede cambiar el tipo de retorno
-- de una función que ya existe, así que sin esto la migración deja de poder
-- reaplicarse en cuanto cambie una columna de salida.
DROP FUNCTION IF EXISTS activar_suscripcion(UUID, TEXT, INT, NUMERIC, TEXT, TEXT);

CREATE FUNCTION activar_suscripcion(
    p_comercio   UUID,
    p_plan       TEXT,
    p_meses      INT DEFAULT 1,
    p_monto      NUMERIC DEFAULT NULL,
    p_referencia TEXT DEFAULT NULL,
    p_quien      TEXT DEFAULT NULL
)
-- Las columnas de salida llevan nombres distintos a los de la tabla a
-- propósito: con `grupos_mes` o `inicio`, PL/pgSQL no sabe si una referencia
-- dentro de la función apunta a la columna o a la variable de retorno, y falla
-- con "column reference is ambiguous".
RETURNS TABLE (id_suscripcion UUID, desde DATE, hasta DATE, cupo INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan_id    UUID;
    v_grupos     INT;
    v_precio     NUMERIC;
    v_inicio     DATE;
    v_fin        DATE;
    v_nueva      UUID;
BEGIN
    IF p_meses < 1 THEN
        RAISE EXCEPTION 'Los meses tienen que ser al menos 1 (llegó %)', p_meses;
    END IF;

    SELECT p.id, p.grupos_mes, p.precio_mes INTO v_plan_id, v_grupos, v_precio
      FROM pa_planes_comercio p WHERE p.nombre = lower(p_plan) AND p.activo;
    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'No existe el plan "%". Los que hay: %',
            p_plan, (SELECT string_agg(nombre, ', ' ORDER BY nivel) FROM pa_planes_comercio WHERE activo);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM comercios c WHERE c.id = p_comercio AND c.deleted_at IS NULL) THEN
        RAISE EXCEPTION 'No existe el comercio %', p_comercio;
    END IF;

    -- El periodo nuevo empieza al día siguiente del vigente, si lo hay. Así
    -- renovar no deja al comercio un día sin cupo ni choca con la restricción
    -- que impide dos periodos solapados.
    SELECT s.fin + 1 INTO v_inicio
      FROM comercio_suscripciones s
     WHERE s.comercio_id = p_comercio
       AND s.estado IN ('prueba', 'activa')
       AND current_date <= s.fin
     ORDER BY s.fin DESC
     LIMIT 1;

    v_inicio := COALESCE(v_inicio, current_date);
    -- `- 1` porque `fin` es inclusivo: un mes desde el 6 de octubre llega al 5
    -- de noviembre, no al 6.
    v_fin := (v_inicio + (p_meses || ' months')::interval)::date - 1;

    INSERT INTO comercio_suscripciones
        (comercio_id, plan_id, grupos_mes, precio_mes, inicio, fin, estado, notas)
    VALUES
        (p_comercio, v_plan_id, v_grupos, v_precio, v_inicio, v_fin, 'activa',
         CASE WHEN p_quien IS NOT NULL THEN 'Activada por ' || p_quien END)
    RETURNING id INTO v_nueva;

    -- El pago va en la misma transacción: si falla, no queda una suscripción
    -- activa sin su cobro registrado.
    IF p_monto IS NOT NULL THEN
        INSERT INTO comercio_pagos
            (suscripcion_id, monto, metodo, referencia, registrado_por)
        VALUES
            (v_nueva, p_monto, 'transferencia', p_referencia, p_quien);
    END IF;

    RETURN QUERY SELECT v_nueva, v_inicio, v_fin, v_grupos;
END;
$$;

COMMENT ON FUNCTION activar_suscripcion(UUID, TEXT, INT, NUMERIC, TEXT, TEXT) IS
    'Da de alta o renueva la suscripción de un comercio tras una transferencia. '
    'Encadena el periodo después del vigente, congela el cupo del tier y registra '
    'el pago si se le pasa el monto.';

GRANT EXECUTE ON FUNCTION activar_suscripcion(UUID, TEXT, INT, NUMERIC, TEXT, TEXT) TO seis_dashboard;
REVOKE EXECUTE ON FUNCTION activar_suscripcion(UUID, TEXT, INT, NUMERIC, TEXT, TEXT) FROM seis_app;

COMMIT;
