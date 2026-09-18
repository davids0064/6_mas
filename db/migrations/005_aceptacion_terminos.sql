-- ============================================================================
-- 005 — Constancia de que la persona aceptó los términos.
--
-- Apple rechazó la 1.0 (4) por guideline 1.2 pidiendo, entre otras cosas, que
-- el acuerdo de términos se presente ANTES de registrarse o iniciar sesión. Lo
-- que había era un enlace en la pantalla de Cuenta, o sea después de entrar:
-- eso informa, pero no es aceptar nada.
--
-- Guardar la fecha no es decorativo. Los términos son lo que sostiene la
-- expulsión de una cuenta por contenido objetable —"aceptaste esto"—, y sin
-- constancia de cuándo se aceptó, esa parte del acuerdo no se puede sostener
-- ante nadie.
-- ============================================================================

BEGIN;

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS terminos_aceptados_at TIMESTAMPTZ;

-- Las cuentas que ya existen quedan con NULL, no con una fecha inventada: no
-- aceptaron nada, porque no había nada que aceptar. La app les pedirá la
-- aceptación en el siguiente arranque, como a cualquiera.
COMMENT ON COLUMN usuarios.terminos_aceptados_at IS
    'Cuándo aceptó los términos de uso. NULL = cuenta anterior a que la aceptación existiera.';

COMMIT;
