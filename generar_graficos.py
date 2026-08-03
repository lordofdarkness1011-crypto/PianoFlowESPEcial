import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os
import scipy.stats as stats

# Configuración de estilo
sns.set_theme(style="whitegrid")
plt.rcParams.update({
    'font.family': 'serif',
    'font.size': 10,
    'axes.labelsize': 11,
    'axes.titlesize': 12,
    'legend.fontsize': 10,
    'figure.dpi': 300, # Alta resolución para el artículo (300 dpi)
})

# Colores de los protocolos
COLOR_HTTP = '#e74c3c'  # Rojo
COLOR_WS = '#3498db'    # Azul

def cargar_datos():
    columnas = ['fase', 'clientId', 'iter', 'rtt', 'cpuLoad', 'ramMB', 'status']
    
    # Comprobar si existen los archivos CSV
    if not os.path.exists('resultados_latencia_http.csv') or not os.path.exists('resultados_latencia_ws.csv'):
        print("ERROR: No se encontraron los archivos CSV ('resultados_latencia_http.csv' y 'resultados_latencia_ws.csv').")
        print("Por favor, asegúrate de que los archivos estén en la misma carpeta que este script.")
        exit(1)
        
    df_http = pd.read_csv('resultados_latencia_http.csv', names=columnas)
    df_ws = pd.read_csv('resultados_latencia_ws.csv', names=columnas)
    
    # Filtrar solo la fase STEADY
    df_http = df_http[df_http['fase'] == 'STEADY'].copy()
    df_ws = df_ws[df_ws['fase'] == 'STEADY'].copy()
    
    # Asegurar que rtt es numérico
    df_http['rtt'] = pd.to_numeric(df_http['rtt'], errors='coerce')
    df_ws['rtt'] = pd.to_numeric(df_ws['rtt'], errors='coerce')
    df_http = df_http.dropna(subset=['rtt'])
    df_ws = df_ws.dropna(subset=['rtt'])
    
    # Añadir columna de protocolo para gráficos combinados
    df_http['protocolo'] = 'HTTP REST'
    df_ws['protocolo'] = 'WebSocket'
    
    return df_http, df_ws

def generar_fig2_lineas(df_http, df_ws):
    print("Generando Figura 2 (Evolución temporal)...")
    plt.figure(figsize=(10, 5))
    
    # Usar un índice global para las iteraciones en STEADY (de 1 a 3600)
    x_http = np.arange(1, len(df_http) + 1)
    x_ws = np.arange(1, len(df_ws) + 1)
    
    # Use a thin line plot so that the high peaks are visually clear
    plt.plot(x_http, df_http['rtt'], color=COLOR_HTTP, linewidth=0.8, alpha=0.7, label='HTTP REST')
    plt.plot(x_ws, df_ws['rtt'], color=COLOR_WS, linewidth=0.8, alpha=0.7, label='WebSocket')
    
    # Línea de umbral crítico
    plt.axhline(y=50, color='black', linestyle='--', linewidth=1.5, label='Critical threshold (50 ms)')
    
    max_y = max(df_http['rtt'].max(), df_ws['rtt'].max()) + 50
    plt.ylim(0, max_y)
    plt.xlabel('Iteration (Steady-state samples)')
    plt.ylabel('RTT Latency (ms)')
    plt.title('Temporal evolution of latency per iteration')
    plt.legend(loc='upper right')
    plt.tight_layout()
    plt.savefig('Fig2_LineasTemporales.png')
    plt.close()

def generar_fig3_boxplot(df_http, df_ws):
    print("Generando Figura 3 (Box Plot)...")
    df_combinado = pd.concat([df_http, df_ws])
    
    plt.figure(figsize=(7, 6))
    
    sns.boxplot(data=df_combinado, x='protocolo', y='rtt', 
                palette={'HTTP REST': COLOR_HTTP, 'WebSocket': COLOR_WS},
                fliersize=4, linewidth=1.5, hue='protocolo', legend=False)
    
    plt.yscale('log')
    plt.gca().yaxis.set_major_formatter(plt.ScalarFormatter())
    
    max_y = df_combinado['rtt'].max() * 1.5
    plt.ylim(30, max_y) # 30 is a safe lower bound since latencies are ~140ms
    plt.xlabel('Protocol')
    plt.ylabel('RTT Latency (ms) [Log Scale]')
    plt.title('Latency distribution and outliers (Lag Spikes)')
    plt.tight_layout()
    plt.savefig('Fig3_BoxPlot.png')
    plt.close()

def generar_fig4_histograma(df_http, df_ws):
    print("Generando Figura 4 (Histograma)...")
    plt.figure(figsize=(10, 5))
    
    plt.hist([df_http['rtt'], df_ws['rtt']], bins=30, color=[COLOR_HTTP, COLOR_WS], 
             label=['HTTP REST', 'WebSocket'], alpha=0.8, edgecolor='black', log=True)
    
    plt.xlabel('RTT Latency (ms)')
    plt.ylabel('Frequency (Number of requests) [Log Scale]')
    plt.title('Latency frequency histogram')
    plt.legend()
    plt.tight_layout()
    plt.savefig('Fig4_Histograma.png')
    plt.close()

def generar_fig5_cdf(df_http, df_ws):
    print("Generando Figura 5 (CDF)...")
    plt.figure(figsize=(10, 5))
    
    # Calcular CDF para HTTP
    rtt_http = np.sort(df_http['rtt'])
    cdf_http = np.arange(1, len(rtt_http) + 1) / len(rtt_http) * 100
    
    # Calcular CDF para WebSocket
    rtt_ws = np.sort(df_ws['rtt'])
    cdf_ws = np.arange(1, len(rtt_ws) + 1) / len(rtt_ws) * 100
    
    plt.plot(rtt_http, cdf_http, color=COLOR_HTTP, linewidth=2, label='HTTP REST')
    plt.plot(rtt_ws, cdf_ws, color=COLOR_WS, linewidth=2, label='WebSocket')
    
    max_x = max(df_http['rtt'].max(), df_ws['rtt'].max()) + 50
    plt.xlim(100, max_x)
    plt.ylim(0, 100)
    plt.xlabel('RTT Latency (ms)')
    plt.ylabel('Cumulative Probability (%)')
    plt.title('Cumulative Distribution Function (CDF)')
    plt.legend(loc='lower right')
    plt.tight_layout()
    plt.savefig('Fig5_CDF.png')
    plt.close()

def generar_fig6_barras_percentiles(df_http, df_ws):
    print("Generando Figura 6 (Percentiles)...")
    plt.figure(figsize=(10, 5))
    
    # Calcular métricas para HTTP
    http_metrics = [
        df_http['rtt'].mean(),
        df_http['rtt'].median(),
        np.percentile(df_http['rtt'], 90),
        np.percentile(df_http['rtt'], 99),
        df_http['rtt'].max()
    ]
    
    # Calcular métricas para WebSocket
    ws_metrics = [
        df_ws['rtt'].mean(),
        df_ws['rtt'].median(),
        np.percentile(df_ws['rtt'], 90),
        np.percentile(df_ws['rtt'], 99),
        df_ws['rtt'].max()
    ]
    
    etiquetas = ['Mean', 'Median', '90th Percentile', '99th Percentile', 'Maximum (Spike)']
    x = np.arange(len(etiquetas))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(10, 5))
    rects1 = ax.bar(x - width/2, http_metrics, width, label='HTTP REST', color=COLOR_HTTP, edgecolor='black')
    rects2 = ax.bar(x + width/2, ws_metrics, width, label='WebSocket', color=COLOR_WS, edgecolor='black')
    
    # Añadir el valor numérico encima de cada barra
    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f'{height:.0f}',
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3),  # 3 puntos de desplazamiento vertical
                        textcoords="offset points",
                        ha='center', va='bottom', fontsize=9)
            
    autolabel(rects1)
    autolabel(rects2)
    
    ax.set_ylabel('RTT Latency (ms)')
    ax.set_title('Comparison of key latencies and percentiles')
    ax.set_xticks(x)
    ax.set_xticklabels(etiquetas)
    ax.legend()
    
    plt.tight_layout()
    plt.savefig('Fig6_Percentiles.png')
    plt.close()

def generar_fig7_welchs_t_test():
    print("Generating Figure 7 (Welch's T-Test)...")
    plt.figure(figsize=(10, 5))
    
    # Parameters
    df = 7179
    t_stat = 23.5997
    alpha = 0.05
    
    # Critical values (two-tailed)
    t_crit = stats.t.ppf(1 - alpha/2, df)
    
    # Range for the main graph (to see the bell curve)
    x = np.linspace(-4, 4, 1000)
    y = stats.t.pdf(x, df)
    
    plt.plot(x, y, 'k-', linewidth=2, label=f"T-distribution (df={df})")
    
    # Rejection regions
    x_rej_right = np.linspace(t_crit, 4, 100)
    plt.fill_between(x_rej_right, stats.t.pdf(x_rej_right, df), color='red', alpha=0.3, label="Rejection Region (α=0.05)")
    x_rej_left = np.linspace(-4, -t_crit, 100)
    plt.fill_between(x_rej_left, stats.t.pdf(x_rej_left, df), color='red', alpha=0.3)
    
    # Critical value lines
    plt.axvline(t_crit, color='red', linestyle='--', alpha=0.7)
    plt.axvline(-t_crit, color='red', linestyle='--', alpha=0.7)
    plt.text(t_crit + 0.1, 0.2, f'+{t_crit:.3f}', color='red', rotation=90)
    plt.text(-t_crit - 0.2, 0.2, f'-{t_crit:.3f}', color='red', rotation=90)
    
    # Annotate the obtained T value which is far to the right
    plt.annotate(
        f'Observed T = {t_stat:.4f}\n(Far in rejection region)', 
        xy=(3.8, 0.02), xytext=(2.0, 0.15),
        arrowprops=dict(facecolor='black', shrink=0.05, width=1.5, headwidth=8),
        fontsize=10, fontweight='bold'
    )
    
    plt.title('Welch\'s T-Test: Hypothesis Rejection Region')
    plt.xlabel('T-value')
    plt.ylabel('Probability Density')
    plt.legend(loc='upper left')
    
    plt.tight_layout()
    plt.savefig('Fig7_Welchs_T_Test.png')
    plt.close()

if __name__ == "__main__":
    print("Iniciando generación de gráficos para Springer LNCS...")
    try:
        df_http, df_ws = cargar_datos()
    except Exception as e:
        print(f"Error cargando los datos: {e}")
        exit(1)
        
    generar_fig2_lineas(df_http, df_ws)
    generar_fig3_boxplot(df_http, df_ws)
    generar_fig4_histograma(df_http, df_ws)
    generar_fig5_cdf(df_http, df_ws)
    generar_fig6_barras_percentiles(df_http, df_ws)
    generar_fig7_welchs_t_test()
    
    print("\n¡Gráficos generados con éxito!")
    print("Archivos creados:")
    print("- Fig2_LineasTemporales.png")
    print("- Fig3_BoxPlot.png")
    print("- Fig4_Histograma.png")
    print("- Fig5_CDF.png")
    print("- Fig6_Percentiles.png")
    print("- Fig7_Welchs_T_Test.png")
