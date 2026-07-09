const express = require('express');

const router = express.Router();

// GET /api/matching — placeholder documentado.
//
// El algoritmo real de matching (agrupar usuarios compatibles en grupos de 6
// según test de personalidad + intereses, y asignar eventos a esos grupos)
// es responsabilidad de una fase posterior del roadmap ("IA de matching").
// El esquema de datos ya deja los ganchos necesarios para implementarlo sin
// migraciones: tests_personalidad.resultado (jsonb), grupo_intereses (pesos
// agregados) y eventos.grupo_id (nullable, se llena cuando el matching decide
// asignar un evento a un grupo). Ver db/DISEÑO.md, sección "Ganchos para
// fases futuras".
router.get('/', (req, res) => {
  res.status(501).json({
    status: 'pendiente',
    mensaje: 'Algoritmo de matching pendiente de implementación (Fase 2 avanzada / IA).',
  });
});

module.exports = router;
