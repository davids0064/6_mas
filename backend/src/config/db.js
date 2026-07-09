// Pool de conexiones a PostgreSQL. Se usa `pg` directo (sin ORM) porque el
// MVP tiene consultas simples y un ORM añadiría una capa de abstracción que
// no se justifica todavía (ver README de la raíz).
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Un error en un cliente inactivo del pool no debe tumbar el proceso;
  // solo se loguea para diagnóstico.
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
