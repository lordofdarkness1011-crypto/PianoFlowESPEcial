# Arquitectura Maestra: Proyecto PianoFlows

**PianoFlows** es una plataforma interactiva web orientada al aprendizaje, práctica y ejecución multijugador del piano. Está diseñada bajo una arquitectura moderna cliente-servidor, que combina procesamiento en tiempo real de eventos MIDI (Musical Instrument Digital Interface) con capacidades de sincronización por WebSockets y síntesis de audio directamente en el navegador.

Este documento detalla exhaustivamente los patrones de diseño, herramientas subyacentes y topología de componentes del sistema en su entorno de producción en vivo.

---

## 1. Topología del Sistema y Stack Tecnológico

El sistema adopta una arquitectura de aplicaciones de una sola página (SPA) respaldada por un servidor de API RESTful y un servidor de WebSockets independiente, operando bajo el stack PERN modificado:

### 1.1 Capa Frontend (Cliente)
- **Librería Core:** React 19.x (Configurado sobre Vite).
- **Enrutamiento:** React Router DOM (Manejo de estado de navegación en el cliente con protección de rutas basada en contextos de sesión).
- **Procesamiento de Audio y MIDI:**
  - `Web MIDI API`: API nativa del navegador para capturar flujos de datos en crudo desde teclados físicos conectados por USB/Bluetooth.
  - `soundfont-player`: Motor principal de muestreo (sampling) utilizado en el modo libre y salas de concierto para reproducir bancos de sonido fotorrealistas de piano acústico.
  - `Tone.js`: Librería de síntesis de audio avanzada, implementada mediante un `PolySynth` acoplado al reloj interno de audio del navegador (`Tone.now()`) para garantizar latencia ultra-baja en el módulo rítmico (Versus).
  - `@tonejs/midi`: Parser binario para deconstruir archivos `.mid` estáticos y transformarlos en estructuras JSON iterables para el motor de caída de notas.
- **Comunicación en Tiempo Real:** `socket.io-client` v4.x.
- **Despliegue:** Netlify (Gestión de CI/CD, distribución a través de CDN perimetral, variables de entorno seguras).
- **Gestión de Medios:** Cloudinary (Almacenamiento y optimización al vuelo de imágenes de perfiles, texturas de sala y recursos estáticos del juego para minimizar el peso del bundle del frontend).

### 1.2 Capa Backend (Servidor)
- **Entorno de Ejecución:** Node.js v22.x.
- **Framework API:** Express.js.
- **Manejo en Tiempo Real:** Socket.io (Motor de eventos bidireccionales, agrupamiento por *Rooms* para gestión de salas privadas/públicas).
- **Módulos de Seguridad y Negocio:**
  - `jsonwebtoken` (JWT): Emisión y validación de tokens de estado de sesión (Stateless Authentication).
  - Google OAuth 2.0: Proveedor de identidad federada para SSO (Single Sign-On).
  - Integración de Pasarelas de Pago: Módulos de orquestación transaccional con **PayPal** y **PayPhone**.
  - Proveedores de Correo: Uso del SDK nativo de **Resend** (`resend`) acoplado a un motor de plantillas de fábrica para la emisión de correos transaccionales (facturas, OTPs, códigos de regalo).
- **Despliegue:** Render.com (Servicios web con escalamiento vertical y balanceo de carga integrado).

### 1.3 Capa de Persistencia (Base de Datos)
- **Motor de Base de Datos:** PostgreSQL Serverless.
- **Despliegue de Datos:** Neon.tech (Permite escalabilidad computacional bajo demanda, branching de base de datos para entornos de desarrollo y alta disponibilidad).
- **Estructura de Datos Crítica:**
  - Tablas relacionales para control de usuarios, historial de partidas (`partidas_multiplayer`) y registros transaccionales.
  - Tabla de Códigos de Regalo (`codigos_regalo`) con control de estado y expiración temporal.
  - Sistema de Roles y Tipos de Suscripción (`freemium`, `premium`, `institucional`).
  - Restricciones referenciales para mantener integridad en el histórico transaccional.

---

## 2. Descripción Profunda de los Módulos Core

### 2.1 Módulo de Práctica Interactiva (Motor de Notas en Caída)
Ubicado en `GameEngine.jsx`. Este módulo actúa como el motor educativo principal.
- **Funcionamiento Algorítmico:** Extrae las pistas y velocidades de un buffer binario MIDI y las proyecta en un `<canvas>` bidimensional (HTML5). Emplea `requestAnimationFrame` para calcular la posición delta de cada nota basándose en `performance.now()`.
- **Detección de Colisiones (Hit Windows):** Contrasta el desplazamiento de la nota generada por software con el evento emitido por la Web MIDI API del teclado físico del usuario en milisegundos.

### 2.2 Salas de Concierto (Multijugador Cooperativo)
Gestionado por `socketController.js`.
- **Topología de Red:** Modelo en estrella. El servidor actúa como intermediario (Relay) de baja latencia que retransmite paquetes de tipo `NOTE_ON` y `NOTE_OFF`.
- **Sincronización:** Cada cliente renderiza los flujos remotos pasándolos por su propia instancia de `soundfont-player`. Utiliza el concepto de "Rooms" de Socket.io para separar tráficos de red; asegurando que 4 pianistas en una sala privada no escuchen las tramas de una sala contigua.

### 2.3 Módulo Versus Experimental (Rhythm Game Asíncrono)
Ubicado en `VersusEngine.jsx` y `versusController.js`. Este módulo implementa un juego competitivo estilo "Tug of War" (Tira y afloja).
- **Asignación Discreta:** A diferencia del motor de 88 teclas, este sistema lee un archivo MIDI y mapea algorítmicamente las notas a 4 carriles finitos (D, F, J, K) utilizando operaciones de módulo matemático (`nota.midi % 4`).
- **Manejo de Estado Dual:**
  - Renderiza una vista de "Split-Screen" (Pantalla Dividida). El estado izquierdo pertenece al bucle local, mientras que el derecho es pasivo, impulsado por telemetría remota.
  - **Eficiencia de Red:** Para prevenir la congestión del servidor, los clientes no envían la posición exacta de cada tecla, sino que calculan las colisiones localmente (Client-Side Prediction) y emiten su vector de estado (Puntuación y Combo) en intervalos regulados de 500ms al servidor.
- **Estabilidad de Audio:** Utiliza el reloj de precisión del contexto de audio web (`Tone.now()`) para garantizar que la ejecución visual y la síntesis sonora no sufran des-sincronización provocada por recolección de basura (Garbage Collection) en el Event Loop de JavaScript.

### 2.4 Sistema de Suscripciones, Facturación y Códigos de Regalo
El modelo de negocio está fundamentado en pasarelas de pago y un motor interno de canje:
- **Tolerancia a Fallos Transaccionales:** Emplea URLs de retorno dinámicas (Return URLs) cifradas. Al confirmar un pago a través de PayPal, el servidor actualiza atómicamente la suscripción del usuario en PostgreSQL y regenera un nuevo JWT permitiendo la recarga en caliente del estado del cliente sin deslogueos.
- **Emisión de Recibos Asíncrona:** A través de un servicio inyectado (`email.service.js`), utiliza las plantillas de facturación para despachar comprobantes de compra usando la infraestructura de **Resend**, evitando bloquear el hilo principal de la petición de pago.
- **Códigos de Regalo (Gift Codes):** Un motor de persistencia paralelo que almacena tokens criptográficos (`crypto.randomBytes`) de uso único vinculados al tiempo de suscripción (ej. 1 mes, 1 año). Estos códigos incluyen expiración algorítmica (3 meses máximo) y cambian atómicamente la suscripción del redentor sumando su tiempo al saldo de tiempo previo si el usuario ya contaba con suscripción activa (`COALESCE(premium_expires_at, CURRENT_TIMESTAMP) + INTERVAL`).

### 2.5 Sistema de Mensajería Transaccional (Resend)
El proyecto orquesta su comunicación hacia el exterior prescindiendo de transportes SMTP pesados (como Nodemailer tradicional) a favor del SDK nativo de **Resend**.
- **Patrón de Fábrica de Plantillas (Template Factory):** Ubicado en el directorio `templates/`, la arquitectura define generadores de HTML puros e independientes (`verification-email`, `gift-code`, `receipt-email`). Estos generadores son inyectados con datos dinámicos (Nombres, Transaction IDs, Códigos) y devuelven estructuras HTML responsivas y textos planos (fallbacks).
- **Envoltorio de Servicio (Service Wrapper):** `email.service.js` actúa como el adaptador (Adapter Pattern) entre los controladores y la API de Resend. Maneja la inyección segura de la `RESEND_API_KEY` y centraliza el manejo de errores (timeouts o rebotes de red), manteniendo la lógica de negocio HTTP (los Controladores) completamente agnóstica de cómo se formatea o despacha el correo.
- **Casos de Uso Críticos:**
  - Envío de pines OTP (`verifyEmailConnection`) para autenticación de doble factor.
  - Envío automatizado de Recibos de Pago (PayPal/PayPhone).
  - Distribución cifrada de los Códigos de Regalo al comprador original.

### 2.6 Tipos de Cuenta (Freemium, Premium e Institucional)
La plataforma opera bajo un modelo Multi-Rol:
- **Freemium:** Acceso de sólo lectura/práctica al motor estándar, con exclusión middleware estricta de rutas `/versus` y de guardado de datos `/partidas`.
- **Premium:** Usuarios de pago con acceso total, persistencia de métricas y desbloqueo del Módulo Versus.
- **Institucional:** (En fase de estructuración) Diseñado para organizaciones (B2B). Un rol administrativo de super-usuario o sub-gestor de academia que permite el anidamiento de sub-cuentas para escuelas de música, donde el maestro pueda visualizar las métricas del motor de caída de notas de sus estudiantes registrados.

---

## 3. Consideraciones Académicas de Diseño (Patrones)

- **Arquitectura Basada en Eventos (Event-Driven Architecture):** Especialmente evidente en la capa de WebSockets. El sistema no hace "polling", reacciona pasivamente a perturbaciones de red (`user_played_note`, `versus_score_update`).
- **Desacoplamiento de Renderizado y Lógica:** El ciclo de vida de React (`useEffect`, `useState`) se usa estrictamente para la gestión del DOM y la instanciación de servicios. Los cálculos intensivos (Interpolación Y de notas) mutan estructuras puras (`useRef`) para evadir el ciclo de "Reconciliación" del Virtual DOM de React, salvaguardando un rendimiento estable de 60 FPS.
- **Gestión de Sesiones (Stateless vs Stateful):** El sistema HTTP RESTful permanece sin estado (JWT) permitiendo un fácil escalamiento horizontal del backend. No obstante, el servidor de WebSockets mantiene un mapa transitorio en memoria RAM (`activeSessions`) para gobernar el estado de las salas, actuar contra abandonos sorpresivos y permitir delegación de anfitriones (Host Migration).

## 4. Seguridad Perimetral y Criptografía
La plataforma implementa controles defensivos de grado industrial contra vulnerabilidades de acceso y manipulación de estado:
- **MFA (Multi-Factor Authentication) y TOTP (Time-Based One-Time Password):** El backend dispone de mecanismos de seguridad de doble factor implementados mediante `authController.js`. Esto incluye la generación de códigos secretos HMAC, códigos de un solo uso (OTP) despachados vía Resend al correo, o validaciones temporales (TOTP) requeridas durante el flujo de inicio de sesión crítico.
- **Cierre Estricto de Rutas (Route Guards):** A nivel del frontend, middleware HOC (Higher-Order Components) aisla funciones exclusivas. A nivel backend, validadores restrictivos (`requirePremiumAuth`) rechazan cualquier telemetría enviada por usuarios "freemium".
- **Validación de Sesiones Dual y Stateless:** El backend ratifica cada acción crítica descifrando la firma asimétrica y la expiración del token JWT (Algoritmo HS256/RS256).
- **Restricción Paramétrica y Escudo de Inyección:** Los parámetros de pago (URLs y Montos) son estrictamente calculados en el back-end (`amount = 999`), desestimando cualquier Payload modificado por cabeceras del cliente.
- **Locks Transaccionales (ACID):** En operaciones de canje de Códigos de Regalo, se utiliza `SELECT ... FOR UPDATE` en PostgreSQL dentro de bloques `BEGIN/COMMIT` para evitar que peticiones concurrentes (Race Conditions) puedan canjear el mismo código más de una vez (Doble Gasto).
