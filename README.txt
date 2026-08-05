# Evidencias y Mejoras P2 - PianoFlows
=========================================================
Autor: Miguel Ángel Molina Luna
Repositorio Público: https://github.com/lordofdarkness1011-crypto/PianoFlowESPEcial.git
Backend Desplegado: https://pianoflowbackend.onrender.com

## 1. Correcciones Principales Realizadas (P2)
Las siguientes evidencias demuestran que las observaciones científicas de la fase P1 fueron atendidas en su totalidad:
1.  **Inferencia Estadística Corregida (LMM y Mann-Whitney):** Para abordar el problema de pseudoreplicación por las muestras correlacionadas de los clientes concurrentes, se aplicó un Modelo Lineal de Efectos Mixtos (Linear Mixed-Effects Model), donde el Cliente fue tratado como un intercepto aleatorio, confirmando la significancia estadística real (p < 0.001). Adicionalmente, se aplicó la prueba U de Mann-Whitney agrupando a nivel de cliente (n=4).
2.  **Validez Externa (WAN Test):** Se eliminó el sesgo de pruebas locales conectando los scripts contra el servidor real en la nube (Render.com).
3.  **Contención del Jitter vs 50ms:** Se demostró empíricamente que el umbral estricto de 50ms es inalcanzable en redes WAN debido a la latencia base (~125ms). La métrica de viabilidad se corrigió para centrarse en la contención de picos máximos de latencia (Jitter).
4.  **Matriz de Degradación (Grid):** Se ejecutaron 16 combinaciones de latencia y pérdida de paquetes usando `tc netem` para probar el límite de degradación. Se comprobó que HTTP REST sufre picos catastróficos de >13 segundos, mientras WebSocket los contiene a <700ms bajo pérdida extrema.
5.  **Verificación de Red (TCP/PCAP):** Se refutó el "Flujo Hipotético" de la Sección 3.2 mediante captura de paquetes (tcpdump). Se evidenció que tanto WebSocket como HTTP (con axios Keep-Alive) reutilizan conexiones TCP persistentes. El bloqueo en HTTP REST se atribuye al Head-of-Line Blocking a nivel de aplicación, no al 3-way handshake.

## 2. Estructura de este ZIP de Evidencias
-   `/datos/`: Archivos `.csv` con los miles de eventos registrados en los experimentos LAN, WAN y las 16 celdas del Grid.
-   `/graficos/`: Las 7 figuras nuevas (Heatmaps del Grid, CDFs, y comparativas de máximos LAN vs WAN).
-   `/scripts/`: Los scripts que permiten reproducir las pruebas.
    -   `latencia_test_wan.js`, `latencia_test_grid.js`: Clientes generadores de tráfico.
    -   `run_grid.sh`: Orquestador Bash que utiliza `tc netem` para emular condiciones.
    -   `analisis_p2.py`, `analisis_wan.py`, `analisis_grid.py`, `mixed_effects_model.py`: Scripts estadísticos de Python (incluyendo el modelo de efectos mixtos).
    -   `generar_pcap.sh`: Orquestador de tcpdump para recolectar firmas de red.
-   `/pcap/`: El archivo `evidencia_red.pcap` (abrible en Wireshark) que prueba la reutilización de TCP.
-   `/documentos/`: Textos generados (como `REESCRITURA_P2.md`) y tablas estadísticas en `.txt` (ej. `Tab_Mixed_Effects_Model.txt`).

## 3. Reproducibilidad
Todos los resultados pueden validarse ejecutando los scripts ubicados en la carpeta `scripts/` utilizando Node.js (v19+) y Python (3.10+) con las librerías indicadas en el repositorio. Para la captura PCAP y el Grid, es necesario entorno Linux con `tc` y `tcpdump`.
