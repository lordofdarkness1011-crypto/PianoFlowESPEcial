"""
analisis_grid.py
================
Generates the operating-region heatmap and summary tables from the
network condition grid experiment.

Reads all CSVs from the grid/ directory:
  grid/grid_d{delay}_l{loss}_http.csv
  grid/grid_d{delay}_l{loss}_ws.csv

Generates:
  Fig_Grid_Heatmap_Miss50.png    Heatmap: >50ms deadline-miss rate
  Fig_Grid_Heatmap_P99.png       Heatmap: P99 latency
  Fig_Grid_Heatmap_WS_Wins.png   Heatmap: WS advantage over HTTP (miss rate diff)
  Fig_Grid_Mean.png              Line chart: mean latency vs delay, per loss level
  Tab_Grid_Full.txt              Full numeric table for all cells
  Tab_Grid_DeadlineMiss.txt      Deadline-miss rate table (20/50/100ms)
"""

import csv
import math
import os
import statistics
import sys

try:
    import numpy as np
    import matplotlib.pyplot as plt
    import matplotlib.colors as mcolors
    from matplotlib import cm
    import matplotlib.ticker as mticker
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

GRID_DIR  = 'grid'
DELAYS    = [0, 20, 50, 100]
LOSSES    = [0, 0.5, 1, 3]
DEADLINES = [20, 50, 100]

COLOR_HTTP = '#e74c3c'
COLOR_WS   = '#3498db'


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def loss_key(loss):
    """Convert float loss to filename-safe key: 0.5 → '0_5'"""
    return str(loss).replace('.', '_')


def load_steady(path):
    if not os.path.exists(path):
        return None
    rtts = []
    with open(path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('Fase') != 'STEADY':
                continue
            try:
                v = float(row['Latencia_ms'])
                if v > 0:   # ignore timeout/error rows (rtt=0)
                    rtts.append(v)
            except (ValueError, KeyError):
                continue
    return rtts if len(rtts) >= 10 else None


def percentile(data, p):
    s = sorted(data)
    idx = (p / 100) * (len(s) - 1)
    lo, hi = int(idx), math.ceil(idx)
    if lo == hi:
        return s[lo]
    return s[lo] * (hi - idx) + s[hi] * (idx - lo)


def miss_rate(rtts, threshold):
    return 100.0 * sum(1 for r in rtts if r > threshold) / len(rtts)


def cell_stats(rtts):
    if rtts is None:
        return None
    return {
        'n':       len(rtts),
        'mean':    statistics.mean(rtts),
        'p90':     percentile(rtts, 90),
        'p99':     percentile(rtts, 99),
        'max':     max(rtts),
        'stdev':   statistics.stdev(rtts),
        'miss_20': miss_rate(rtts, 20),
        'miss_50': miss_rate(rtts, 50),
        'miss_100':miss_rate(rtts, 100),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Load all grid data
# ═══════════════════════════════════════════════════════════════════════════

print(f"Loading grid data from ./{GRID_DIR}/...")

if not os.path.isdir(GRID_DIR):
    print(f"[ERROR] Directory '{GRID_DIR}' not found.")
    print("  Run ./run_grid.sh first to collect the grid data.")
    sys.exit(1)

# grid_data[delay][loss] = {'http': stats_dict, 'ws': stats_dict}
grid_data = {}
missing   = []

for delay in DELAYS:
    grid_data[delay] = {}
    for loss in LOSSES:
        lk = loss_key(loss)
        http_path = os.path.join(GRID_DIR, f'grid_d{delay}_l{lk}_http.csv')
        ws_path   = os.path.join(GRID_DIR, f'grid_d{delay}_l{lk}_ws.csv')

        http_rtts = load_steady(http_path)
        ws_rtts   = load_steady(ws_path)

        if http_rtts is None or ws_rtts is None:
            missing.append(f'd={delay}ms l={loss}%')
            grid_data[delay][loss] = None
        else:
            grid_data[delay][loss] = {
                'http': cell_stats(http_rtts),
                'ws':   cell_stats(ws_rtts),
            }
            print(f"  ✓ d={delay:>3}ms l={loss:>4}%  "
                  f"HTTP n={len(http_rtts)} mean={statistics.mean(http_rtts):.0f}ms  "
                  f"WS n={len(ws_rtts)} mean={statistics.mean(ws_rtts):.0f}ms")

if missing:
    print(f"\n[WARNING] {len(missing)} cells missing: {missing}")
    print("  These cells will appear as grey in heatmaps.")

available = sum(1 for d in DELAYS for l in LOSSES if grid_data[d][l] is not None)
print(f"\nLoaded {available}/{len(DELAYS)*len(LOSSES)} cells.\n")

if available == 0:
    print("[ERROR] No grid data found. Run ./run_grid.sh first.")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════
# Build 2-D arrays for heatmaps
# ═══════════════════════════════════════════════════════════════════════════

def build_matrix(metric, proto):
    """Returns (nrows=delays, ncols=losses) numpy array, NaN for missing."""
    mat = np.full((len(DELAYS), len(LOSSES)), np.nan)
    for i, d in enumerate(DELAYS):
        for j, l in enumerate(LOSSES):
            cell = grid_data[d][l]
            if cell is not None:
                mat[i, j] = cell[proto][metric]
    return mat


def build_diff_matrix(metric):
    """Returns HTTP[metric] - WS[metric]. Positive = HTTP worse."""
    mat = np.full((len(DELAYS), len(LOSSES)), np.nan)
    for i, d in enumerate(DELAYS):
        for j, l in enumerate(LOSSES):
            cell = grid_data[d][l]
            if cell is not None:
                mat[i, j] = cell['http'][metric] - cell['ws'][metric]
    return mat


# ═══════════════════════════════════════════════════════════════════════════
# Heatmap helper
# ═══════════════════════════════════════════════════════════════════════════

def draw_heatmap(mat, title, cbar_label, filename,
                 cmap='YlOrRd', fmt='.0f', vmin=None, vmax=None,
                 center=None, annot_suffix=''):

    fig, ax = plt.subplots(figsize=(8, 5))

    if center is not None:
        # Diverging colormap centered on zero
        bound = max(abs(np.nanmin(mat)), abs(np.nanmax(mat))) if vmin is None else max(abs(vmin), abs(vmax))
        if bound == 0:
            bound = 1  # avoid degenerate norm when all values are equal
        norm  = mcolors.TwoSlopeNorm(vmin=-bound, vcenter=0, vmax=bound)
        im    = ax.imshow(mat, cmap='RdYlGn', norm=norm, aspect='auto')
    else:
        kwargs = {'cmap': cmap, 'aspect': 'auto'}
        if vmin is not None: kwargs['vmin'] = vmin
        if vmax is not None: kwargs['vmax'] = vmax
        im = ax.imshow(mat, **kwargs)

    plt.colorbar(im, ax=ax, label=cbar_label)

    # Annotations
    for i in range(mat.shape[0]):
        for j in range(mat.shape[1]):
            v = mat[i, j]
            if not np.isnan(v):
                color = 'white' if im.norm(v) > 0.6 else 'black'
                ax.text(j, i, f'{v:{fmt}}{annot_suffix}',
                        ha='center', va='center', fontsize=9,
                        fontweight='bold', color=color)
            else:
                ax.text(j, i, 'N/A', ha='center', va='center',
                        fontsize=8, color='grey')

    ax.set_xticks(range(len(LOSSES)))
    ax.set_xticklabels([f'{l}%' for l in LOSSES])
    ax.set_yticks(range(len(DELAYS)))
    ax.set_yticklabels([f'{d} ms' for d in DELAYS])
    ax.set_xlabel('Packet Loss (%)')
    ax.set_ylabel('Added Delay (ms)')
    ax.set_title(title)
    plt.tight_layout()
    plt.savefig(filename, dpi=300)
    plt.close()
    print(f"  → {filename}")


# ═══════════════════════════════════════════════════════════════════════════
# Generate figures
# ═══════════════════════════════════════════════════════════════════════════

print("Generating heatmaps...")

# ── Heatmap 1: >50ms deadline-miss rate — WebSocket ─────────────────────
mat_ws_miss50  = build_matrix('miss_50', 'ws')
mat_http_miss50 = build_matrix('miss_50', 'http')

draw_heatmap(
    mat_ws_miss50,
    title='WebSocket: Events Exceeding 50 ms Deadline (%)\n'
          '(Musical coherence threshold — operating region map)',
    cbar_label='Deadline-Miss Rate (%)',
    filename='Fig_Grid_Heatmap_WS_Miss50.png',
    cmap='YlOrRd', fmt='.1f', annot_suffix='%',
    vmin=0, vmax=100
)

draw_heatmap(
    mat_http_miss50,
    title='HTTP REST: Events Exceeding 50 ms Deadline (%)\n'
          '(Musical coherence threshold — operating region map)',
    cbar_label='Deadline-Miss Rate (%)',
    filename='Fig_Grid_Heatmap_HTTP_Miss50.png',
    cmap='YlOrRd', fmt='.1f', annot_suffix='%',
    vmin=0, vmax=100
)

# ── Heatmap 2: P99 latency — WebSocket ──────────────────────────────────
mat_ws_p99 = build_matrix('p99', 'ws')
draw_heatmap(
    mat_ws_p99,
    title='WebSocket: P99 Latency by Network Condition (ms)',
    cbar_label='P99 RTT (ms)',
    filename='Fig_Grid_Heatmap_WS_P99.png',
    cmap='Blues', fmt='.0f', annot_suffix=' ms'
)

mat_http_p99 = build_matrix('p99', 'http')
draw_heatmap(
    mat_http_p99,
    title='HTTP REST: P99 Latency by Network Condition (ms)',
    cbar_label='P99 RTT (ms)',
    filename='Fig_Grid_Heatmap_HTTP_P99.png',
    cmap='Reds', fmt='.0f', annot_suffix=' ms'
)

# ── Heatmap 3: WS advantage (HTTP miss50 - WS miss50) ───────────────────
mat_diff = build_diff_matrix('miss_50')
draw_heatmap(
    mat_diff,
    title='Deadline-Miss Advantage: HTTP REST − WebSocket (%)\n'
          '(Green = WS misses fewer deadlines; Red = HTTP misses fewer)',
    cbar_label='HTTP miss% − WS miss% (positive = WS better)',
    filename='Fig_Grid_Heatmap_Advantage.png',
    center=0, fmt='.1f', annot_suffix='%'
)

# ── Line chart: mean latency vs delay for each loss level ───────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 5), sharey=False)
loss_colors = ['#2ecc71', '#f39c12', '#e74c3c', '#8e44ad']

for ax, proto, color_base, title in [
    (axes[0], 'http', COLOR_HTTP, 'HTTP REST'),
    (axes[1], 'ws',   COLOR_WS,   'WebSocket'),
]:
    for j, (loss, lc) in enumerate(zip(LOSSES, loss_colors)):
        means = []
        for delay in DELAYS:
            cell = grid_data[delay][loss]
            means.append(cell[proto]['mean'] if cell else np.nan)
        ax.plot(DELAYS, means, marker='o', color=lc,
                linewidth=2, label=f'{loss}% loss')

    ax.axhline(50, color='black', linestyle='--', linewidth=1,
               label='50 ms threshold')
    ax.set_xlabel('Added Delay (ms)')
    ax.set_ylabel('Mean RTT (ms)')
    ax.set_title(f'{title}: Mean Latency vs Network Condition')
    ax.set_xticks(DELAYS)
    ax.legend(fontsize=8)

plt.tight_layout()
plt.savefig('Fig_Grid_Mean_Lines.png', dpi=300)
plt.close()
print("  → Fig_Grid_Mean_Lines.png")

# ── Side-by-side max latency comparison ─────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 5))
x      = np.arange(len(DELAYS) * len(LOSSES))
labels = [f'd{d}L{l}' for d in DELAYS for l in LOSSES]
http_maxes = [grid_data[d][l]['http']['max'] if grid_data[d][l] else 0
              for d in DELAYS for l in LOSSES]
ws_maxes   = [grid_data[d][l]['ws']['max']   if grid_data[d][l] else 0
              for d in DELAYS for l in LOSSES]

ax.bar(x - 0.2, http_maxes, 0.4, label='HTTP REST', color=COLOR_HTTP, edgecolor='black', alpha=0.85)
ax.bar(x + 0.2, ws_maxes,   0.4, label='WebSocket', color=COLOR_WS,   edgecolor='black', alpha=0.85)
ax.axhline(50, color='black', linestyle='--', linewidth=1, label='50 ms threshold')
ax.set_xticks(x)
ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=7)
ax.set_ylabel('Max RTT Latency (ms)')
ax.set_title('Maximum Latency per Grid Cell: HTTP REST vs WebSocket\n'
             '(d=delay ms, L=loss %)')
ax.legend()
plt.tight_layout()
plt.savefig('Fig_Grid_Max_Comparison.png', dpi=300)
plt.close()
print("  → Fig_Grid_Max_Comparison.png")


# ═══════════════════════════════════════════════════════════════════════════
# Full text table
# ═══════════════════════════════════════════════════════════════════════════

print("\nGenerating summary tables...")
lines = ['=' * 100,
         'TABLE: Full Grid Results — Mean | P99 | Max | >50ms% — HTTP REST vs WebSocket',
         f"{'Condition':>18} | {'HTTP Mean':>10} | {'HTTP P99':>9} | {'HTTP Max':>9} | "
         f"{'HTTP >50%':>9} | {'WS Mean':>9} | {'WS P99':>8} | {'WS Max':>8} | {'WS >50%':>8} | {'WS Better':>9}",
         '-' * 100]

for delay in DELAYS:
    for loss in LOSSES:
        cell = grid_data[delay][loss]
        cond = f'd={delay}ms l={loss}%'
        if cell is None:
            lines.append(f"{cond:>18} | {'N/A':>10} | {'N/A':>9} | {'N/A':>9} | "
                         f"{'N/A':>9} | {'N/A':>9} | {'N/A':>8} | {'N/A':>8} | {'N/A':>8} | {'N/A':>9}")
        else:
            h, w = cell['http'], cell['ws']
            ws_better = '✓ WS' if w['miss_50'] < h['miss_50'] else '  HTTP' if h['miss_50'] < w['miss_50'] else '  TIE'
            lines.append(
                f"{cond:>18} | {h['mean']:>9.1f}ms | {h['p99']:>8.1f}ms | {h['max']:>8.1f}ms | "
                f"{h['miss_50']:>8.1f}% | {w['mean']:>8.1f}ms | {w['p99']:>7.1f}ms | {w['max']:>7.1f}ms | "
                f"{w['miss_50']:>7.1f}% | {ws_better:>9}"
            )
    lines.append('-' * 100)

lines.append('=' * 100)
table_text = '\n'.join(lines)
print(table_text)
with open('Tab_Grid_Full.txt', 'w') as f:
    f.write(table_text + '\n')


# ═══════════════════════════════════════════════════════════════════════════
# Summary: at which conditions does WS win?
# ═══════════════════════════════════════════════════════════════════════════

ws_wins = sum(1 for d in DELAYS for l in LOSSES
              if grid_data[d][l] and grid_data[d][l]['ws']['miss_50'] < grid_data[d][l]['http']['miss_50'])
total_available = sum(1 for d in DELAYS for l in LOSSES if grid_data[d][l] is not None)

summary_lines = [
    '=' * 70,
    'GRID EXPERIMENT SUMMARY',
    '=' * 70,
    f'  Cells completed: {available}/{len(DELAYS)*len(LOSSES)}',
    f'  WS outperforms HTTP (>50ms miss rate): {ws_wins}/{total_available} conditions',
    f'  HTTP outperforms WS: {total_available - ws_wins}/{total_available} conditions',
    '',
    '  Operating region interpretation:',
]
for delay in DELAYS:
    for loss in LOSSES:
        cell = grid_data[delay][loss]
        if cell:
            h_m = cell['http']['miss_50']
            w_m = cell['ws']['miss_50']
            winner = 'WS' if w_m < h_m else ('HTTP' if h_m < w_m else 'TIE')
            summary_lines.append(
                f"    delay={delay:>3}ms loss={loss:>4}%  →  "
                f"HTTP {h_m:.1f}% miss  WS {w_m:.1f}% miss  [{winner}]"
            )
summary_lines.append('=' * 70)
summary_text = '\n'.join(summary_lines)
print('\n' + summary_text)
with open('Tab_Grid_Summary.txt', 'w') as f:
    f.write(summary_text + '\n')

print('\n✔  analisis_grid.py complete.')
print('   Key outputs: Fig_Grid_Heatmap_*.png, Tab_Grid_Full.txt')
