# 🎹 PianoFlow Web: Arquitectura Distribuida para Aprendizaje Musical

**PianoFlow Web** es una plataforma distribuida, colaborativa y competitiva diseñada para el aprendizaje musical y la ejecución de piano en la web. Permite a múltiples usuarios conectar teclados físicos MIDI, unirse a salas virtuales con aforo controlado, competir en un modo estilo *Osu!mania*, y ensamblar piezas musicales en tiempo real con una latencia ultra-baja.

Este proyecto ha sido desarrollado cumpliendo estrictamente con la rúbrica y exigencias académicas de despliegue, seguridad, observabilidad y arquitectura Cliente-Servidor (PERN Stack Avanzado).

![PianoFlow Architecture](https://img.shields.io/badge/Architecture-Distributed_PERN-blue)
![Status](https://img.shields.io/badge/Status-Production_Ready-success)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Características Principales

### 🎮 Modos de Juego y Práctica
- **Módulo de Práctica (GameEngine):** Aprende tocando. El motor interpreta archivos `.mid` y renderiza la caída visual de las notas. Al presionar las teclas exactas en tu piano físico en el momento preciso, sumarás puntuación (Sincronización mediante *Web MIDI API*).
- **Salas de Concierto (Multijugador):** Salas efímeras mediante WebSockets (hasta 4 participantes) para tocar en conjunto. El sonido de los demás participantes se renderiza localmente usando *soundfont-player*.
- **Módulo Versus (Rhythm Game):** *(Exclusivo Premium)* Un modo competitivo estilo *Tug of War* (Tira y afloja). Sistema asíncrono con telemetría predictiva, renderizado de pantalla dividida y sonidos sintetizados en tiempo real mediante *Tone.js*.

### 🔒 Seguridad de Grado Industrial y Modelos de Negocio
- **Identidad Federada y JWT (Stateless):** Autenticación tradicional y mediante **Google OAuth 2.0**. Autorización por roles (`freemium`, `premium`, `institucional`).
- **Autenticación Multi-Factor (MFA / TOTP):** Pines de un solo uso generados criptográficamente para validación de doble factor.
- **Panel Administrativo (God Mode):** Un dashboard dedicado para la gestión integral de la plataforma. Permite la **suspensión lógica de usuarios (Soft Delete)**, obsequiar meses Premium directamente a cuentas estándar, y generar Códigos de Regalo manualmente (sin procesar pagos) para distribución en campañas.
- **Auditoría de Facturación:** El sistema registra de manera inmutable el ciclo de vida de los Códigos de Regalo, permitiendo al Administrador rastrear quién emitió el código, quién lo canjeó, su estado actual y la fecha de expiración.
- **Transacciones y Suscripciones:** Integración oficial con **PayPal** y **PayPhone** empleando Return URLs y Webhooks pasivos para compras y regalos.
- **Códigos de Regalo (Gift Codes):** Motor criptográfico (`crypto.randomBytes`) que emite códigos de regalo. Utiliza bloqueos de bases de datos `SELECT ... FOR UPDATE` para evitar vulnerabilidades de doble gasto (Race Conditions).

### ⚡ Arquitectura y Rendimiento
- **Desacoplamiento del DOM:** Renderizado de caída de notas a 60FPS eludiendo el ciclo de vida de React mediante lienzos `Canvas` bidimensionales (HTML5).
- **Motor Web Audio API:** Síntesis sonora con `Tone.now()` para precisión de milisegundos evitando el stuttering por recolección de basura del motor de JavaScript.
- **Sistema de Mensajería Transaccional:** Notificaciones asíncronas, envío de pines y recibos de facturación mediante el SDK nativo de **Resend** implementando el Patrón de Fábrica de Plantillas (Template Factory).

---

## 🛠️ Stack Tecnológico y Despliegue

### Capa Frontend (Cliente)
- **Framework:** React.js (Vite) / React Router
- **APIs:** HTML5 Canvas, Web MIDI API, Web Audio API
- **Audio & MIDI:** `soundfont-player`, `Tone.js`, `@tonejs/midi`
- **Despliegue:** Netlify (CDN Perimetral)

### Capa Backend (Servidor)
- **Framework:** Node.js (Express.js)
- **Sockets:** Socket.io
- **Mailing:** Resend SDK
- **Pagos:** PayPal SDK, PayPhone SDK
- **Despliegue:** Render.com

### Capa de Persistencia y Medios
- **Base de Datos Relacional:** PostgreSQL Serverless
- **Host de Base de Datos:** Neon.tech
- **Gestión de Medios:** Cloudinary (Almacenamiento de imágenes de perfil/avatars, resolviendo nativamente la variable global de entorno `CLOUDINARY_URL` para una integración cloud-native fluida y entregando los assets vía CDN).

---

## 🚀 Requisitos Previos (Desarrollo Local)

Antes de ejecutar el proyecto, asegúrate de contar con el siguiente software instalado en tu entorno local:
- **Node.js** (v22.x recomendado) y `npm`
- **PostgreSQL** (Opcionalmente mediante Docker si no deseas instalarlo nativo)
- **Git**

---

## ⚙️ Instrucciones de Instalación Local

Sigue los pasos a continuación para levantar toda la arquitectura de la aplicación localmente:

### 1. Clonar el repositorio
```bash
git clone https://github.com/lordofdarkness1011-crypto/PianoFlowESPEcial.git
cd PianoFlowESPEcial
```

### 2. Base de Datos
El proyecto utiliza PostgreSQL. Ejecuta el archivo `init.sql` incluido en la raíz en tu servidor PostgreSQL para construir la estructura y esquemas iniciales (tablas de usuarios, partidas, códigos de regalo, etc.).

### 3. Configuración de Variables de Entorno (.env)
Se ha provisto un archivo `.env.example` en la carpeta `backend/`. 
Debes copiarlo, renombrarlo a `.env` e ingresar las credenciales válidas.
```bash
cd backend
cp .env.example .env
```
*(Debes configurar `DATABASE_URL` apuntando a tu PostgreSQL local o Neon.tech, `JWT_SECRET`, credenciales de OAuth, `RESEND_API_KEY`, etc.)*

### 4. Instalar Dependencias e Iniciar el Backend
En la carpeta `backend/`, instala los paquetes e inicializa Node:
```bash
npm install
npm run dev
```
*El servidor REST y WebSocket correrá por defecto en `http://localhost:3000`*.

### 5. Instalar Dependencias e Iniciar el Frontend
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
2. Haz clic en **"Iniciar sesión con Google"** o regístrate mediante correo electrónico.
3. (Opcional) Conecta un piano vía cable USB-MIDI o Bluetooth MIDI a tu computadora.
4. Navega a la sección **Modo Libre**, **Salas de Concierto**, o aventúrate en el **Modo Versus** para competir con otros pianistas conectados.
5. Adquiere una suscripción Premium mediante pasarelas de prueba para desbloquear todo el potencial.


## 📝 Autores y Reconocimientos

- **Desarrollador:** Equipo PianoFlows.
