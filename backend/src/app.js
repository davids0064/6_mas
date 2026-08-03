const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

// Cabeceras de seguridad por defecto (nosniff, frameguard, HSTS, etc.). La CSP
// se desactiva porque esta API solo devuelve JSON: no sirve documentos HTML
// donde una CSP tenga algo que proteger.
app.use(helmet({ contentSecurityPolicy: false }));

// Railway y cualquier PaaS ponen un proxy delante. Sin esto req.ip es la IP
// del proxy, y el rate limiting metería a todo el mundo en el mismo balde.
app.set('trust proxy', 1);

// CORS con lista blanca explícita, nunca '*'. Se lee de CORS_ORIGENES para que
// agregar el dominio de producción sea una variable de entorno y no un
// despliegue de código.
//
// Sin la variable definida no se permite ningún origen de navegador. Eso NO
// afecta a la app móvil (fetch nativo no aplica CORS), así que un despliegue
// al que se le olvidó la variable sigue sirviendo a la app y solo bloquea a
// clientes web no declarados, que es el comportamiento seguro.
const origenesPermitidos = (process.env.CORS_ORIGENES || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origen, callback) {
      // Sin cabecera Origin: peticiones que no vienen de un navegador (la app
      // móvil, curl, los health checks del PaaS). CORS no las gobierna.
      if (!origen) return callback(null, true);
      return callback(null, origenesPermitidos.includes(origen));
    },
  })
);

// Límite explícito al tamaño del cuerpo. El default de Express ya es 100kb,
// pero dejarlo escrito evita que una futura subida de imágenes lo agrande sin
// que nadie lo note.
app.use(express.json({ limit: '100kb' }));

// Rate limiting sobre lo único que se puede atacar por fuerza bruta sin token:
// probar contraseñas y crear cuentas en masa.
//
// Son dos limitadores separados y no uno compartido porque protegen de cosas
// distintas: adivinar la contraseña de una cuenta que ya existe, y crear
// cuentas basura. Con un contador único, alguien probando contraseñas también
// dejaría sin registrarse a quien comparte su IP.
function limitador({ ventanaMin, max }) {
  return rateLimit({
    windowMs: ventanaMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos.' },
    // Los procesos internos que se autentican como administradores (el script
    // de siembra, una futura importación) no son fuerza bruta: ya probaron
    // quiénes son con una credencial. Sin esta excepción, sembrar 6 usuarios
    // de prueba agota el límite de toda la IP.
    skip: (req) => {
      const clave = process.env.ADMIN_API_KEY;
      return Boolean(clave) && req.get('X-Admin-Key') === clave;
    },
  });
}

// Detrás de NAT (una oficina, una universidad) mucha gente comparte IP, así
// que los umbrales son configurables sin tocar código.
const limiteLogin = limitador({
  ventanaMin: 15,
  max: Number(process.env.RATE_LIMIT_LOGIN || 10),
});
const limiteRegistro = limitador({
  ventanaMin: 60,
  max: Number(process.env.RATE_LIMIT_REGISTRO || 20),
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Se aplican antes de montar el router para que corran sobre esas dos rutas
// concretas y no sobre toda la API autenticada.
app.use('/api/usuarios/login', limiteLogin);
app.post('/api/usuarios', limiteRegistro);

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
