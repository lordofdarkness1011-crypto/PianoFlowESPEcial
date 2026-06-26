# 🎹 PianoFlow Web: Arquitectura Distribuida para Aprendizaje Musical

PianoFlow Web es una aplicación distribuida colaborativa diseñada para el aprendizaje musical en tiempo real a través de la web. Permite a múltiples usuarios conectar teclados físicos MIDI, unirse a salas virtuales con aforo controlado (hasta 4 participantes) y ensamblar piezas musicales con una latencia mínima, garantizando una experiencia interactiva sin interrupciones.

Este proyecto ha sido desarrollado como trabajo final para la asignatura **Aplicaciones Distribuidas**, cumpliendo estrictamente con la rúbrica y exigencias académicas de despliegue, seguridad, observabilidad y arquitectura Cliente-Servidor.

---

## ✨ Características Principales (Cumplimiento de Rúbrica)

- 📡 **WebSockets & Tiempo Real (Socket.io):** Salas virtuales efímeras que permiten la conexión simultánea de 4 integrantes como máximo, retransmitiendo eventos musicales de forma bidireccional y controlando activamente el aforo.
- ⚡ **Concurrencia (Web Workers):** Uso del paralelismo del navegador enviando la captura de la *Web MIDI API* hacia un hilo secundario asíncrono para evitar bloqueos del DOM (UI) bajo ráfagas intensivas de notas físicas.
- 🔒 **Identidad Federada y JWT (Stateless):** Acceso seguro implementado **exclusivamente con Google OAuth 2.0**. Autorización delegada manejada mediante middlewares de verificación de JSON Web Tokens (JWT) que limitan accesos en base a suscripciones (`freemium` / `premium`).
- 💿 **Transacciones Relacionales ACID:** Protección de la integridad de los datos en PostgreSQL utilizando bloques explícitos `BEGIN`, `COMMIT` y `ROLLBACK` para el almacenamiento del historial de usuarios.
- 🕵️ **Observabilidad y Manejo de Errores:** Middleware global que intercepta cualquier excepción del lado del servidor Express. Registro (logs) estructurado en consola y en el archivo físico `app.log` utilizando **Winston**.
- 🎵 **Motor Web Audio API:** Procesamiento híbrido de alta fidelidad con instrumentos Soundfonts y muestras en crudo (`.wav`). Cuenta con inserción matemática de un algoritmo **Hard Limiter** que evita el *clipping* digital y protege los parlantes físicos de los usuarios contra daños.
- 🐳 **Infraestructura Contenedorizada:** Base de datos PostgreSQL y motor documental PocketBase aislados mediante `docker-compose.yml`.

---

## 🛠️ Tecnologías Utilizadas

### Frontend
- **Framework:** React.js (Vite)
- **APIs:** HTML5 Canvas, Web MIDI API, Web Audio API, Service Workers
- **Autenticación:** `@react-oauth/google`

### Backend
- **Framework:** Node.js (Express) con patrón multicapas (Routes, Controllers, Services, Middlewares)
- **Sockets:** Socket.io
- **Seguridad y Logs:** `jsonwebtoken`, `google-auth-library`, `winston`

### Base de Datos e Infraestructura
- **Base Relacional:** PostgreSQL
- **Base Documental & Storage:** PocketBase
- **Orquestación:** Docker y Docker Compose

---

## 🚀 Requisitos Previos

Antes de ejecutar el proyecto, asegúrate de contar con el siguiente software instalado en tu entorno local:
- **Node.js** (v18.0 o superior) y `npm`
- **Docker** y **Docker Compose**
- **Git**

---

## ⚙️ Instrucciones de Instalación y Ejecución Local

Sigue los pasos a continuación para levantar toda la arquitectura de la aplicación:

### 1. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd ProyectoPianoFLows
```

### 2. Levantar la Infraestructura de Base de Datos (Docker)
Inicializaremos PostgreSQL y PocketBase aislados. En la raíz del proyecto, ejecuta:
```bash
docker-compose up -d
```
*Esto montará automáticamente las tablas iniciales mediante el archivo `init.sql`.*

### 3. Configuración de Variables de Entorno (.env)
Se ha provisto un archivo `.env.example` en la carpeta `backend/`. 
Debes copiarlo, renombrarlo a `.env` e ingresar las credenciales válidas (evitando subir secretos al repositorio público).

```bash
cd backend
cp .env.example .env
```
*(Abre el archivo `.env` y configura el puerto `3000`, la URL de la base de datos `DATABASE_URL`, la semilla secreta `JWT_SECRET` y el ID del cliente `GOOGLE_CLIENT_ID`)*.

### 4. Instalar Dependencias e Iniciar el Servidor (Backend)
En la carpeta `backend/`, instala los paquetes e inicializa Node:
```bash
npm install
npm start
```
*El servidor REST y WebSocket correrá en `http://localhost:3000`*.

### 5. Instalar Dependencias e Iniciar el Cliente (Frontend)
Abre una nueva terminal, ve a la carpeta `frontend/` y haz lo mismo:
```bash
cd frontend
npm install
npm run dev
```
*La interfaz gráfica correrá en el puerto asignado por Vite (generalmente `http://localhost:5173`).*

---

## 🎹 Uso de la aplicación

1. Abre tu navegador web en la URL que arrojó el frontend.
2. Haz clic en **"Iniciar sesión con Google"**.
3. (Opcional) Conecta un piano vía cable MIDI a tu computadora.
4. Navega a la sección **Salas de Concierto**, entra a una sala disponible y empieza a tocar en conjunto con otros músicos conectados en la red.

---

## 📝 Autores y Reconocimientos
Proyecto desarrollado para la asignatura de **Aplicaciones Distribuidas**.
- **Desarrollador:** [Tu Nombre / Usuario]
