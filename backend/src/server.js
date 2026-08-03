require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Verificación de arranque. Preferimos que el proceso no levante a que levante
// mal: un backend sin JWT_SECRET firmaría tokens que cualquiera puede
// fabricar, y uno sin DATABASE_URL fallaría recién en la primera consulta,
// cuando ya hay clientes conectados.
//
// ADMIN_API_KEY no se exige acá: si falta, las rutas de administración
// responden 503 (ver middleware/auth.js). Un despliegue puede querer no
// exponerlas en absoluto, y eso es una configuración válida, no un error.
const REQUERIDAS = ['DATABASE_URL', 'JWT_SECRET'];
const faltantes = REQUERIDAS.filter((v) => !process.env[v]);

if (faltantes.length) {
  console.error(
    `No se puede arrancar: faltan variables de entorno (${faltantes.join(', ')}).\n` +
      'Copia backend/.env.example a backend/.env y complétalas.'
  );
  process.exit(1);
}

// 0.0.0.0 en vez de localhost: necesario para que un dispositivo físico en
// la misma red LAN pueda alcanzar el backend desde la app móvil (ver
// mobile/README.md, sección "Conectar con el backend local").
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Seis Más backend escuchando en el puerto ${PORT}`);
});
