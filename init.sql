-- Eliminación de tablas y tipos existentes (Reset)
DROP TABLE IF EXISTS partidas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TYPE IF EXISTS nivel_habilidad_enum CASCADE;
DROP TYPE IF EXISTS tipo_suscripcion_enum CASCADE;

-- Creación de tipos ENUM para asegurar la consistencia de los datos
CREATE TYPE nivel_habilidad_enum AS ENUM ('principiante', 'intermedio', 'invitado');
CREATE TYPE tipo_suscripcion_enum AS ENUM ('freemium', 'premium', 'institucional');

-- Creación de la tabla Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    nombre VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    nivel_habilidad nivel_habilidad_enum NOT NULL DEFAULT 'invitado',
    tipo_suscripcion tipo_suscripcion_enum NOT NULL DEFAULT 'freemium',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    pending_mfa_secret TEXT,
    verification_code VARCHAR(10),
    expires_at TIMESTAMP,
    verification_attempts INTEGER DEFAULT 0,
    puntuacion_total INTEGER DEFAULT 0,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    premium_expires_at TIMESTAMP WITH TIME ZONE
);

-- Tabla para almacenar los códigos de regalo
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

-- Tabla auxiliar para guardar el historial de puntuaciones de las partidas 
-- (relacionado al requisito de transacciones SQL más adelante)
CREATE TABLE IF NOT EXISTS partidas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    cancion_id VARCHAR(255) NOT NULL,
    puntuacion INTEGER NOT NULL,
    fecha_partida TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_google_id ON usuarios(google_id);

-- Función y Trigger para actualizar automáticamente la columna 'actualizado_en'
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_timestamp
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp();

-- =========================================================================
-- Datos de prueba iniciales (Semillas)
-- =========================================================================

INSERT INTO usuarios (google_id, email, nombre, nivel_habilidad, tipo_suscripcion, puntuacion_total)
VALUES 
    ('google-demo-1', 'freemium@pianoflow.com', 'Usuario Freemium', 'principiante', 'freemium', 150),
    ('google-demo-2', 'premium@pianoflow.com', 'Usuario Premium', 'intermedio', 'premium', 1500),
    ('google-demo-3', 'institucional@pianoflow.com', 'Usuario Institucional', 'intermedio', 'institucional', 2000)
ON CONFLICT (email) DO NOTHING;
