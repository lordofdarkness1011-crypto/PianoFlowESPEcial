require("dotenv").config();
const pool = require("./utils/db");

async function migrate() {
  try {
    console.log("Iniciando migración de base de datos...");
    
    await pool.query(`
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log("Columna premium_expires_at añadida.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS codigos_regalo (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(12) UNIQUE NOT NULL,
        duracion_meses INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'no usado',
        comprador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        usuario_redencion_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        fecha_expiracion TIMESTAMP WITH TIME ZONE,
        fecha_uso TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log("Tabla codigos_regalo creada.");
    
    console.log("Migración completada con éxito.");
    process.exit(0);
  } catch (error) {
    console.error("Error en migración:", error);
    process.exit(1);
  }
}

migrate();
