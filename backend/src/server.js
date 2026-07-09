require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

// 0.0.0.0 en vez de localhost: necesario para que un dispositivo físico en
// la misma red LAN pueda alcanzar el backend desde la app móvil (ver
// mobile/README.md, sección "Conectar con el backend local").
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Seis Más backend escuchando en el puerto ${PORT}`);
});
