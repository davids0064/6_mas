const express = require('express');
const cors = require('cors');

const usuariosRouter = require('./routes/usuarios');
const interesesRouter = require('./routes/intereses');
const generosRouter = require('./routes/generos');
const gruposRouter = require('./routes/grupos');
const comerciosRouter = require('./routes/comercios');
const anfitrionesRouter = require('./routes/anfitriones');
const eventosRouter = require('./routes/eventos');
const feedbackRouter = require('./routes/feedback');
const matchingRouter = require('./routes/matching');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/usuarios', usuariosRouter);
app.use('/api/intereses', interesesRouter);
app.use('/api/generos', generosRouter);
app.use('/api/grupos', gruposRouter);
app.use('/api/comercios', comerciosRouter);
app.use('/api/anfitriones', anfitrionesRouter);
app.use('/api/eventos', eventosRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/matching', matchingRouter);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Debe registrarse al final: Express identifica el error handler por su
// firma de 4 argumentos (err, req, res, next).
app.use(errorHandler);

module.exports = app;
