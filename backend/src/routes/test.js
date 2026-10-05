// El cuestionario del test de personalidad.
//
// Público y sin token, como /api/intereses y /api/generos: la app lo pide antes
// de que exista sesión. No expone nada sensible — son las mismas veinte
// preguntas que hasta ahora viajaban dentro del binario.
const express = require('express');
const cuestionario = require('../services/cuestionario');

const router = express.Router();

// GET /api/test/preguntas
router.get('/preguntas', async (req, res, next) => {
  try {
    const preguntas = await cuestionario.cargar();

    // El cliente guarda la versión junto a sus respuestas (`version_test`), así
    // que un test contestado hoy se puede distinguir de uno contestado tras
    // cambiar el cuestionario. Mientras las preguntas no cambien de forma
    // incompatible, la versión se queda en 1.
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ version: 1, preguntas });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
