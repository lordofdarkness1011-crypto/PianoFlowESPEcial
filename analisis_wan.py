"""
analisis_wan.py
===============
Comparative analysis: LAN (Clumsy-emulated) vs WAN (real Render.com server).
Addresses the professor's External Validity observation in P2 feedback.

Reads:
  resultados_latencia_http.csv  ← original LAN HTTP (50ms lag + 1% loss)
  resultados_latencia_ws.csv    ← original LAN WebSocket (50ms lag + 1% loss)
  resultados_wan_http.csv       ← new WAN HTTP (real cloud, no emulation)
  resultados_wan_ws.csv         ← new WAN WebSocket (real cloud, no emulation)

Generates:
  Fig_LAN_vs_WAN_Mean.png        Bar chart: mean latency comparison
  Fig_LAN_vs_WAN_CDF.png         CDF overlay: 4 conditions
  Fig_LAN_vs_WAN_Percentiles.png Extended percentiles: all 4 conditions
  Tab_LAN_vs_WAN.txt             Full comparison table
  Tab_WAN_DeadlineMiss.txt       Deadline-miss rates for WAN condition
"""

import csv
import math
import os
import statistics
import sys

try:
    import numpy as np
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import scipy.stats as sci_stats
except ImportError:
    print("[ERROR] Missing dependencies. Run: source venv/bin/activate")
    sys.exit(1)

plt.rcParams.update({
    'font.family': 'serif',
    'font.size': 10,
    'axes.labelsize': 11,
    'axes.titlesize': 12,
    'legend.fontsize': 9,
    'figure.dpi': 300,
})

# Colors: LAN = solid, WAN = lighter / hatched
COLOR_HTTP      = '#e74c3c'
COLOR_WS        = '#3498db'
COLOR_HTTP_WAN  = '#f1948a'
COLOR_WS_WAN    = '#85c1e9'
DEADLINES       = [20, 50, 100]


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def load_steady(path):
    """Load only STEADY-phase RTT values from a CSV."""
    if not os.path.exists(path):
        return None
    rtts = []
    with open(path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('Fase') != 'STEADY':
                continue
            try:
                rtts.append(float(row['Latencia_ms']))
            except (ValueError, KeyError):
                continue
    return rtts if rtts else None


def percentile(data, p):
    s = sorted(data)
    idx = (p / 100) * (len(s) - 1)
    lo, hi = int(idx), math.ceil(idx)
    if lo == hi:
        return s[lo]
    return s[lo] * (hi - idx) + s[hi] * (idx - lo)


def miss_rate(rtts, threshold):
    return 100.0 * sum(1 for r in rtts if r > threshold) / len(rtts)


def summary(rtts, label):
    return {
        'label':    label,
        'n':        len(rtts),
        'mean':     statistics.mean(rtts),
        'median':   statistics.median(rtts),
        'p90':      percentile(rtts, 90),
        'p95':      percentile(rtts, 95),
        'p99':      percentile(rtts, 99),
        'p999':     percentile(rtts, 99.9),
        'max':      max(rtts),
        'stdev':    statistics.stdev(rtts),
        'miss_20':  miss_rate(rtts, 20),
        'miss_50':  miss_rate(rtts, 50),
        'miss_100': miss_rate(rtts, 100),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Load data
# ═══════════════════════════════════════════════════════════════════════════

print("Loading data...")
lan_http = load_steady('resultados_latencia_http.csv')
lan_ws   = load_steady('resultados_latencia_ws.csv')
wan_http = load_steady('resultados_wan_http.csv')
wan_ws   = load_steady('resultados_wan_ws.csv')

if not (lan_http and lan_ws):
    print("[ERROR] LAN CSV files not found. Run the original latencia_test.js first.")
    sys.exit(1)

wan_available = wan_http is not None and wan_ws is not None
if not wan_available:
    print("[WARNING] WAN CSV files not found.")
    print("  Run latencia_test_wan.js against your Render.com server first.")
    print("  Proceeding with LAN-only summary for now.\n")

s_lan_http = summary(lan_http, 'LAN — HTTP REST')
s_lan_ws   = summary(lan_ws,   'LAN — WebSocket')

summaries = [s_lan_http, s_lan_ws]
if wan_available:
    s_wan_http = summary(wan_http, 'WAN — HTTP REST')
    s_wan_ws   = summary(wan_ws,   'WAN — WebSocket')
    summaries  = [s_lan_http, s_lan_ws, s_wan_http, s_wan_ws]
    print(f"  LAN HTTP: {len(lan_http)} samples | LAN WS: {len(lan_ws)} samples")
    print(f"  WAN HTTP: {len(wan_http)} samples | WAN WS: {len(wan_ws)} samples\n")
else:
    print(f"  LAN HTTP: {len(lan_http)} samples | LAN WS: {len(lan_ws)} samples (WAN: pending)\n")


# ═══════════════════════════════════════════════════════════════════════════
# Comparison table (text)
# ═══════════════════════════════════════════════════════════════════════════

print("Generating comparison table...")
col_w = 22
header_row = ['Metric'] + [s['label'] for s in summaries]
sep = '=' * (16 + col_w * len(summaries))

lines = [sep, 'TABLE: LAN vs WAN Latency Comparison', sep]
lines.append(f"{'Metric':>16}" + ''.join(f"{h:>{col_w}}" for h in [s['label'] for s in summaries]))
lines.append('-' * (16 + col_w * len(summaries)))

for key, label in [
    ('n',       'N (samples)'),
    ('mean',    'Mean (ms)'),
    ('median',  'Median (ms)'),
    ('p90',     'P90 (ms)'),
    ('p95',     'P95 (ms)'),
    ('p99',     'P99 (ms)'),
    ('p999',    'P99.9 (ms)'),
    ('max',     'Max (ms)'),
    ('stdev',   'Std Dev (ms)'),
    ('miss_20', '>20ms miss %'),
    ('miss_50', '>50ms miss %'),
    ('miss_100','>100ms miss %'),
]:
    row = f"{label:>16}"
    for s in summaries:
        val = s[key]
        if key == 'n':
            row += f"{int(val):>{col_w}}"
        elif key in ('miss_20', 'miss_50', 'miss_100'):
            row += f"{val:>{col_w-1}.1f}%"
        else:
            row += f"{val:>{col_w-2}.2f} ms"
    lines.append(row)

lines.append(sep)
if not wan_available:
    lines.append("NOTE: WAN data not yet available. Run latencia_test_wan.js to complete.")
    lines.append(sep)

table_text = '\n'.join(lines)
print(table_text)
with open('Tab_LAN_vs_WAN.txt', 'w') as f:
    f.write(table_text + '\n')


# ═══════════════════════════════════════════════════════════════════════════
# Figures
# ═══════════════════════════════════════════════════════════════════════════

print("\nGenerating figures...")

# ── Fig 1: Mean latency grouped bar chart ───────────────────────────────────
fig, ax = plt.subplots(figsize=(9, 5))

conditions  = ['HTTP REST', 'WebSocket']
lan_means   = [s_lan_http['mean'], s_lan_ws['mean']]
x           = np.arange(len(conditions))
bar_w       = 0.3

bars_lan = ax.bar(x - bar_w/2, lan_means, bar_w,
                  label='LAN (50ms lag + 1% loss emulated)',
                  color=[COLOR_HTTP, COLOR_WS], edgecolor='black')

if wan_available:
    wan_means = [s_wan_http['mean'], s_wan_ws['mean']]
    bars_wan  = ax.bar(x + bar_w/2, wan_means, bar_w,
                       label='WAN (real Render.com server)',
                       color=[COLOR_HTTP_WAN, COLOR_WS_WAN],
                       edgecolor='black', hatch='//')
    for bar in bars_wan:
        ax.annotate(f'{bar.get_height():.0f}ms',
                    xy=(bar.get_x() + bar.get_width()/2, bar.get_height()),
                    xytext=(0, 3), textcoords='offset points',
                    ha='center', va='bottom', fontsize=9)

for bar in bars_lan:
    ax.annotate(f'{bar.get_height():.0f}ms',
                xy=(bar.get_x() + bar.get_width()/2, bar.get_height()),
                xytext=(0, 3), textcoords='offset points',
                ha='center', va='bottom', fontsize=9)

ax.axhline(50, color='black', linestyle='--', linewidth=1.2,
           label='50 ms coherence threshold')
ax.set_xticks(x)
ax.set_xticklabels(conditions)
ax.set_ylabel('Mean RTT Latency (ms)')
ax.set_title('Mean Latency: LAN (Emulated Adverse) vs WAN (Real Cloud)\n'
             '4 concurrent clients · 900 steady-state samples each')
ax.legend(fontsize=8)
plt.tight_layout()
plt.savefig('Fig_LAN_vs_WAN_Mean.png', dpi=300)
plt.close()
print("  → Fig_LAN_vs_WAN_Mean.png")

# ── Fig 2: CDF overlay — all conditions ────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 5))

datasets = [
    (lan_http, COLOR_HTTP,     '-',  'LAN HTTP REST'),
    (lan_ws,   COLOR_WS,       '-',  'LAN WebSocket'),
]
if wan_available:
    datasets += [
        (wan_http, COLOR_HTTP_WAN, '--', 'WAN HTTP REST'),
        (wan_ws,   COLOR_WS_WAN,   '--', 'WAN WebSocket'),
    ]

for rtts, color, ls, label in datasets:
    s   = np.sort(rtts)
    cdf = np.arange(1, len(s) + 1) / len(s) * 100
    ax.plot(s, cdf, color=color, linestyle=ls, linewidth=1.8, label=label)

for d, col in zip(DEADLINES, ['#27ae60', '#e67e22', '#8e44ad']):
    ax.axvline(d, color=col, linestyle=':', linewidth=1.2, alpha=0.7,
               label=f'{d} ms deadline')

all_rtts = lan_http + lan_ws + (wan_http or []) + (wan_ws or [])
ax.set_xlim(0, min(900, max(all_rtts) * 1.05))
ax.set_ylim(0, 100)
ax.set_xlabel('RTT Latency (ms)')
ax.set_ylabel('Cumulative Events (%)')
ax.set_title('CDF Comparison: LAN Emulated vs WAN Real\n'
             '(Solid = LAN with Clumsy · Dashed = Real Render.com server)')
ax.legend(loc='lower right', fontsize=8)
plt.tight_layout()
plt.savefig('Fig_LAN_vs_WAN_CDF.png', dpi=300)
plt.close()
print("  → Fig_LAN_vs_WAN_CDF.png")

# ── Fig 3: Percentile comparison ───────────────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 5))
pct_labels = ['Mean', 'P50', 'P90', 'P95', 'P99', 'Max']
pct_keys   = ['mean', 'p50', 'p90', 'p95', 'p99', 'max']

def get_vals(s):
    # p50 = median
    return [s['mean'], s['median'], s['p90'], s['p95'], s['p99'], s['max']]

x    = np.arange(len(pct_labels))
n    = 2 + (2 if wan_available else 0)
bw   = 0.2
offsets = np.linspace(-(n-1)*bw/2, (n-1)*bw/2, n)

bar_configs = [
    (s_lan_http, COLOR_HTTP,     '', 'LAN HTTP REST'),
    (s_lan_ws,   COLOR_WS,       '', 'LAN WebSocket'),
]
if wan_available:
    bar_configs += [
        (s_wan_http, COLOR_HTTP_WAN, '//', 'WAN HTTP REST'),
        (s_wan_ws,   COLOR_WS_WAN,   '//', 'WAN WebSocket'),
    ]

for i, (s, color, hatch, label) in enumerate(bar_configs):
    vals = get_vals(s)
    ax.bar(x + offsets[i], vals, bw, label=label,
           color=color, edgecolor='black', hatch=hatch, alpha=0.85)

ax.axhline(50, color='black', linestyle='--', linewidth=1.2,
           label='50 ms threshold')
ax.set_xticks(x)
ax.set_xticklabels(pct_labels)
ax.set_ylabel('RTT Latency (ms)')
ax.set_title('Latency Percentile Comparison: LAN vs WAN, by Protocol')
ax.legend(fontsize=8)
plt.tight_layout()
plt.savefig('Fig_LAN_vs_WAN_Percentiles.png', dpi=300)
plt.close()
print("  → Fig_LAN_vs_WAN_Percentiles.png")


# ═══════════════════════════════════════════════════════════════════════════
# WAN deadline-miss table
# ═══════════════════════════════════════════════════════════════════════════

if wan_available:
    wan_dm_lines = ['=' * 60, 'TABLE: WAN Deadline-Miss Rates (Real Render.com Server)',
                    f"{'Threshold':>12} | {'WAN HTTP':>12} | {'WAN WebSocket':>14}",
                    '-' * 60]
    for d in DEADLINES:
        wan_dm_lines.append(
            f"{d:>10} ms | {s_wan_http[f'miss_{d}']:>10.2f} % | {s_wan_ws[f'miss_{d}']:>13.2f} %"
        )
    wan_dm_lines += ['=' * 60,
                     'Compare with LAN (emulated 50ms lag + 1% loss):',
                     f"  LAN HTTP  >50ms: {s_lan_http['miss_50']:.1f}%",
                     f"  LAN WS    >50ms: {s_lan_ws['miss_50']:.1f}%",
                     '=' * 60]
    wan_dm_text = '\n'.join(wan_dm_lines)
    print('\n' + wan_dm_text)
    with open('Tab_WAN_DeadlineMiss.txt', 'w') as f:
        f.write(wan_dm_text + '\n')


print("\n✔  analisis_wan.py complete.")
if not wan_available:
    print("\n[NEXT STEP] Run latencia_test_wan.js to collect WAN data,")
    print("  then re-run this script to get the full LAN vs WAN comparison.")
