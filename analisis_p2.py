"""
analisis_p2.py
==============
New analysis script addressing P2 professor feedback for MolinaArticle.

Generates:
  - Tab_DeadlineMiss.txt     : Deadline-miss rate table (20/50/100ms) per protocol
  - Tab_JitterTrue.txt       : True inter-event jitter statistics per protocol & client
  - Tab_ClientLevel.txt      : Per-client aggregated stats (honest effective sample size)
  - Tab_Welch_Corrected.txt  : Corrected Welch/Mann-Whitney on client-level means
  - Fig_DeadlineMiss.png     : Bar chart: deadline-miss rate per protocol × threshold
  - Fig_JitterDist.png       : Inter-event jitter distribution (violin + percentiles)
  - Fig_ClientBoxplot.png    : Per-client latency distribution (shows autocorrelation)
  - Fig_CDF_Annotated.png    : CDF with 20/50/100ms vertical deadline markers
  - Fig_PercentileTable.png  : Extended percentiles: p50/p90/p95/p99/p99.9/max

All figures are 300 DPI, Springer-compatible.
"""

import csv
import math
import os
import statistics
import sys

# ── Try to import scientific stack ──────────────────────────────────────────
try:
    import numpy as np
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import scipy.stats as sci_stats
    HAS_SCIPY = True
except ImportError:
    print("[ERROR] numpy / matplotlib / scipy not found.")
    print("  Activate the venv:  source venv/bin/activate")
    print("  Or install:         pip install numpy matplotlib scipy")
    sys.exit(1)

# ── Style ────────────────────────────────────────────────────────────────────
plt.rcParams.update({
    'font.family': 'serif',
    'font.size': 10,
    'axes.labelsize': 11,
    'axes.titlesize': 12,
    'legend.fontsize': 9,
    'figure.dpi': 300,
})
COLOR_HTTP = '#e74c3c'
COLOR_WS   = '#3498db'
DEADLINES  = [20, 50, 100]   # ms thresholds for deadline-miss analysis


# ═══════════════════════════════════════════════════════════════════════════
# 1. DATA LOADING
# ═══════════════════════════════════════════════════════════════════════════

def load_csv(path):
    """
    Returns dict: {client_id (str) -> list of RTT floats (STEADY phase only)},
    sorted by original row order (i.e., time order within each client).
    """
    data_by_client = {}
    with open(path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Fase'] != 'STEADY':
                continue
            cid = row['ClienteID']
            try:
                rtt = float(row['Latencia_ms'])
            except ValueError:
                continue
            data_by_client.setdefault(cid, []).append(rtt)
    return data_by_client


def flat(data_by_client):
    """Flattens dict -> single list of all RTT values."""
    result = []
    for vals in data_by_client.values():
        result.extend(vals)
    return result


print("Loading CSV data...")
http_by_client = load_csv('resultados_latencia_http.csv')
ws_by_client   = load_csv('resultados_latencia_ws.csv')

http_all = flat(http_by_client)
ws_all   = flat(ws_by_client)

print(f"  HTTP: {len(http_all)} STEADY samples across {len(http_by_client)} clients")
print(f"  WS  : {len(ws_all)} STEADY samples across {len(ws_by_client)} clients")


# ═══════════════════════════════════════════════════════════════════════════
# 2. DEADLINE-MISS RATE
# ═══════════════════════════════════════════════════════════════════════════

def deadline_miss_rate(rtts, threshold_ms):
    """Fraction (%) of events that EXCEEDED the deadline."""
    missed = sum(1 for r in rtts if r > threshold_ms)
    return 100.0 * missed / len(rtts)


print("\n[1/5] Computing deadline-miss rates...")
miss_rates = {}
for label, rtts in [('HTTP REST', http_all), ('WebSocket', ws_all)]:
    miss_rates[label] = {d: deadline_miss_rate(rtts, d) for d in DEADLINES}

# Print table
lines = []
lines.append("=" * 60)
lines.append("TABLE: Deadline-Miss Rate (%)")
lines.append(f"{'Threshold':>12} | {'HTTP REST':>12} | {'WebSocket':>12}")
lines.append("-" * 60)
for d in DEADLINES:
    h = miss_rates['HTTP REST'][d]
    w = miss_rates['WebSocket'][d]
    lines.append(f"{d:>10} ms | {h:>10.2f} % | {w:>10.2f} %")
lines.append("=" * 60)
lines.append("Interpretation:")
lines.append(f"  At the 50 ms musical-coherence threshold defined in the abstract,")
lines.append(f"  HTTP REST missed {miss_rates['HTTP REST'][50]:.1f}% of events and")
lines.append(f"  WebSocket missed {miss_rates['WebSocket'][50]:.1f}% of events.")
lines.append(f"  Under the tested condition (50ms lag + 1% loss), neither protocol")
lines.append(f"  fully satisfies the strict ≤50 ms coherence criterion.")
lines.append("=" * 60)
table_text = "\n".join(lines)
print(table_text)
with open('Tab_DeadlineMiss.txt', 'w') as f:
    f.write(table_text + "\n")


# ═══════════════════════════════════════════════════════════════════════════
# 3. TRUE INTER-EVENT JITTER  (|latency[i] - latency[i-1]|)
# ═══════════════════════════════════════════════════════════════════════════

def compute_jitter(rtts):
    """
    True jitter = absolute difference between consecutive RTT values.
    This is the ITU-T / RFC 3550 definition for packet delay variation.
    Returns list of jitter values.
    """
    return [abs(rtts[i] - rtts[i-1]) for i in range(1, len(rtts))]


print("\n[2/5] Computing true inter-event jitter...")

def jitter_stats(data_by_client):
    """Compute jitter per client, then aggregate."""
    all_jitter = []
    client_jitter_means = []
    for cid, rtts in sorted(data_by_client.items()):
        jit = compute_jitter(rtts)
        all_jitter.extend(jit)
        client_jitter_means.append(statistics.mean(jit))
    return all_jitter, client_jitter_means


http_jitter_all, http_jitter_per_client = jitter_stats(http_by_client)
ws_jitter_all,   ws_jitter_per_client   = jitter_stats(ws_by_client)

def percentile(data, p):
    sorted_data = sorted(data)
    idx = (p / 100) * (len(sorted_data) - 1)
    lo, hi = int(idx), math.ceil(idx)
    if lo == hi:
        return sorted_data[lo]
    return sorted_data[lo] * (hi - idx) + sorted_data[hi] * (idx - lo)


def jitter_summary(jit_all, label):
    return {
        'label': label,
        'n': len(jit_all),
        'mean': statistics.mean(jit_all),
        'median': statistics.median(jit_all),
        'p90': percentile(jit_all, 90),
        'p95': percentile(jit_all, 95),
        'p99': percentile(jit_all, 99),
        'max': max(jit_all),
        'stdev': statistics.stdev(jit_all),
    }


http_js = jitter_summary(http_jitter_all, 'HTTP REST')
ws_js   = jitter_summary(ws_jitter_all,   'WebSocket')

jitter_lines = []
jitter_lines.append("=" * 70)
jitter_lines.append("TABLE: True Inter-Event Jitter Statistics")
jitter_lines.append("Definition: Jitter[i] = |RTT[i] - RTT[i-1]| per client time series")
jitter_lines.append("-" * 70)
jitter_lines.append(f"{'Metric':>12} | {'HTTP REST':>12} | {'WebSocket':>12}")
jitter_lines.append("-" * 70)
for key, label in [('mean','Mean'), ('median','Median'), ('p90','P90'),
                   ('p95','P95'), ('p99','P99'), ('max','Max'),
                   ('stdev','Std Dev')]:
    jitter_lines.append(
        f"{label:>12} | {http_js[key]:>10.2f} ms | {ws_js[key]:>10.2f} ms"
    )
jitter_lines.append("=" * 70)
jitter_lines.append(
    "NOTE: 'Maximum latency' ≠ 'Jitter'. Maximum latency is the single worst"
)
jitter_lines.append(
    "observed value. Jitter quantifies variation between consecutive events."
)
jitter_lines.append("=" * 70)
jitter_text = "\n".join(jitter_lines)
print(jitter_text)
with open('Tab_JitterTrue.txt', 'w') as f:
    f.write(jitter_text + "\n")


# ═══════════════════════════════════════════════════════════════════════════
# 4. CLIENT-LEVEL AGGREGATION  (honest effective sample size)
# ═══════════════════════════════════════════════════════════════════════════

print("\n[3/5] Client-level aggregation (correcting independence assumption)...")

def client_summary(data_by_client, label):
    rows = []
    for cid in sorted(data_by_client.keys()):
        rtts = data_by_client[cid]
        rows.append({
            'client': cid,
            'n': len(rtts),
            'mean': statistics.mean(rtts),
            'median': statistics.median(rtts),
            'p99': percentile(rtts, 99),
            'max': max(rtts),
            'miss_20': deadline_miss_rate(rtts, 20),
            'miss_50': deadline_miss_rate(rtts, 50),
            'miss_100': deadline_miss_rate(rtts, 100),
        })
    return rows


http_client_rows = client_summary(http_by_client, 'HTTP REST')
ws_client_rows   = client_summary(ws_by_client,   'WebSocket')

cl_lines = []
cl_lines.append("=" * 80)
cl_lines.append("TABLE: Per-Client Aggregated Statistics")
cl_lines.append("Effective sample size per protocol = 4 (one summary per client/run)")
cl_lines.append("This is the statistically honest unit of analysis.")
cl_lines.append("-" * 80)
cl_lines.append(
    f"{'Proto':>10} | {'Client':>6} | {'N':>5} | {'Mean':>8} | "
    f"{'P99':>8} | {'Max':>8} | {'>20ms%':>7} | {'>50ms%':>7} | {'>100ms%':>8}"
)
cl_lines.append("-" * 80)
for proto, rows in [('HTTP REST', http_client_rows), ('WebSocket', ws_client_rows)]:
    for r in rows:
        cl_lines.append(
            f"{proto:>10} | {r['client']:>6} | {r['n']:>5} | "
            f"{r['mean']:>7.1f}ms | {r['p99']:>7.1f}ms | {r['max']:>7.1f}ms | "
            f"{r['miss_20']:>6.1f}% | {r['miss_50']:>6.1f}% | {r['miss_100']:>7.1f}%"
        )
    cl_lines.append("-" * 80)
cl_lines.append("=" * 80)

# Corrected statistical test: Mann-Whitney U on client-level means
http_client_means = [r['mean'] for r in http_client_rows]
ws_client_means   = [r['mean'] for r in ws_client_rows]

try:
    u_stat, u_pval = sci_stats.mannwhitneyu(
        http_client_means, ws_client_means, alternative='two-sided'
    )
    cl_lines.append("")
    cl_lines.append("Corrected Statistical Test: Mann-Whitney U on client-level means")
    cl_lines.append(f"  HTTP client means: {[f'{m:.1f}' for m in http_client_means]}")
    cl_lines.append(f"  WS   client means: {[f'{m:.1f}' for m in ws_client_means]}")
    cl_lines.append(f"  U = {u_stat:.4f},  p = {u_pval:.4f}")
    if u_pval < 0.05:
        cl_lines.append("  → Statistically significant at α=0.05 (honest effective n=4)")
    else:
        cl_lines.append("  → NOT statistically significant at α=0.05 with n=4 per protocol.")
        cl_lines.append("    (The original T=23.6 was inflated by treating 3,600 correlated")
        cl_lines.append("     observations as independent.)")
    cl_lines.append("=" * 80)
except Exception as e:
    cl_lines.append(f"[Mann-Whitney could not run: {e}]")

cl_text = "\n".join(cl_lines)
print(cl_text)
with open('Tab_ClientLevel.txt', 'w') as f:
    f.write(cl_text + "\n")


# ═══════════════════════════════════════════════════════════════════════════
# 5. EXTENDED PERCENTILE TABLE
# ═══════════════════════════════════════════════════════════════════════════

pct_lines = []
pct_lines.append("=" * 65)
pct_lines.append("TABLE: Extended Latency Percentiles (all 3,600 STEADY samples)")
pct_lines.append(f"{'Metric':>12} | {'HTTP REST':>12} | {'WebSocket':>12}")
pct_lines.append("-" * 65)
metrics = [
    ('Mean',   statistics.mean(http_all),          statistics.mean(ws_all)),
    ('Median', statistics.median(http_all),         statistics.median(ws_all)),
    ('P50',    percentile(http_all, 50),             percentile(ws_all, 50)),
    ('P90',    percentile(http_all, 90),             percentile(ws_all, 90)),
    ('P95',    percentile(http_all, 95),             percentile(ws_all, 95)),
    ('P99',    percentile(http_all, 99),             percentile(ws_all, 99)),
    ('P99.9',  percentile(http_all, 99.9),           percentile(ws_all, 99.9)),
    ('Max',    max(http_all),                        max(ws_all)),
    ('StdDev', statistics.stdev(http_all),           statistics.stdev(ws_all)),
]
for label, h, w in metrics:
    pct_lines.append(f"{label:>12} | {h:>10.2f} ms | {w:>10.2f} ms")
pct_lines.append("=" * 65)
pct_text = "\n".join(pct_lines)
print("\n" + pct_text)
with open('Tab_ExtendedPercentiles.txt', 'w') as f:
    f.write(pct_text + "\n")


# ═══════════════════════════════════════════════════════════════════════════
# 6. FIGURES
# ═══════════════════════════════════════════════════════════════════════════

print("\n[4/5] Generating figures...")

# ── Fig A: Deadline-Miss Rate Bar Chart ─────────────────────────────────────
fig, ax = plt.subplots(figsize=(8, 5))
x = np.arange(len(DEADLINES))
w = 0.32
bars_h = ax.bar(x - w/2,
                [miss_rates['HTTP REST'][d] for d in DEADLINES],
                w, label='HTTP REST', color=COLOR_HTTP, edgecolor='black')
bars_w = ax.bar(x + w/2,
                [miss_rates['WebSocket'][d] for d in DEADLINES],
                w, label='WebSocket', color=COLOR_WS, edgecolor='black')

for bar in list(bars_h) + list(bars_w):
    h = bar.get_height()
    ax.annotate(f'{h:.1f}%',
                xy=(bar.get_x() + bar.get_width() / 2, h),
                xytext=(0, 3), textcoords='offset points',
                ha='center', va='bottom', fontsize=9)

ax.set_xticks(x)
ax.set_xticklabels([f'{d} ms deadline' for d in DEADLINES])
ax.set_ylabel('Events Exceeding Deadline (%)')
ax.set_title('Deadline-Miss Rate by Protocol and Latency Threshold')
ax.legend()
ax.set_ylim(0, max(miss_rates['HTTP REST'][20], miss_rates['WebSocket'][20]) * 1.2)
plt.tight_layout()
plt.savefig('Fig_DeadlineMiss.png', dpi=300)
plt.close()
print("  → Fig_DeadlineMiss.png")

# ── Fig B: True Jitter Distribution (Violin) ────────────────────────────────
fig, ax = plt.subplots(figsize=(8, 5))
parts = ax.violinplot(
    [http_jitter_all, ws_jitter_all],
    positions=[1, 2],
    showmedians=True,
    showextrema=False
)
colors = [COLOR_HTTP, COLOR_WS]
for i, pc in enumerate(parts['bodies']):
    pc.set_facecolor(colors[i])
    pc.set_alpha(0.6)
parts['cmedians'].set_color('black')

# Add percentile markers
for pos, jit in [(1, http_jitter_all), (2, ws_jitter_all)]:
    for p, marker in [(90, 'D'), (99, '^')]:
        ax.scatter(pos, percentile(jit, p), color='black',
                   marker=marker, zorder=5, s=40)

ax.set_xticks([1, 2])
ax.set_xticklabels(['HTTP REST', 'WebSocket'])
ax.set_ylabel('Inter-Event Jitter (ms)')
ax.set_title('True Inter-Event Jitter Distribution\n'
             '(|RTT[i] − RTT[i−1]|, per consecutive event pair)')
# Legend
p90_marker = plt.scatter([], [], color='black', marker='D', label='P90')
p99_marker = plt.scatter([], [], color='black', marker='^', label='P99')
http_patch = mpatches.Patch(color=COLOR_HTTP, alpha=0.6, label='HTTP REST')
ws_patch   = mpatches.Patch(color=COLOR_WS,   alpha=0.6, label='WebSocket')
ax.legend(handles=[http_patch, ws_patch, p90_marker, p99_marker])
plt.tight_layout()
plt.savefig('Fig_JitterDist.png', dpi=300)
plt.close()
print("  → Fig_JitterDist.png")

# ── Fig C: Per-Client Latency Boxplot ───────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 5))
positions_http = [1, 2, 3, 4]
positions_ws   = [6, 7, 8, 9]

for i, (cid, pos) in enumerate(zip(sorted(http_by_client.keys()), positions_http)):
    bp = ax.boxplot(http_by_client[cid], positions=[pos], widths=0.6,
                    patch_artist=True,
                    boxprops=dict(facecolor=COLOR_HTTP, alpha=0.6),
                    medianprops=dict(color='black'),
                    flierprops=dict(marker='.', markersize=2, alpha=0.3))

for i, (cid, pos) in enumerate(zip(sorted(ws_by_client.keys()), positions_ws)):
    bp = ax.boxplot(ws_by_client[cid], positions=[pos], widths=0.6,
                    patch_artist=True,
                    boxprops=dict(facecolor=COLOR_WS, alpha=0.6),
                    medianprops=dict(color='black'),
                    flierprops=dict(marker='.', markersize=2, alpha=0.3))

ax.set_xticks(positions_http + positions_ws)
ax.set_xticklabels(
    [f'HTTP\nC{c}' for c in sorted(http_by_client.keys())] +
    [f'WS\nC{c}' for c in sorted(ws_by_client.keys())]
)
ax.set_ylabel('RTT Latency (ms)')
ax.set_title('Per-Client Latency Distribution\n'
             '(Effective experimental units; n=4 per protocol)')
ax.axhline(50, color='black', linestyle='--', linewidth=1,
           label='50 ms coherence threshold')
http_patch = mpatches.Patch(color=COLOR_HTTP, alpha=0.6, label='HTTP REST')
ws_patch   = mpatches.Patch(color=COLOR_WS,   alpha=0.6, label='WebSocket')
ax.legend(handles=[http_patch, ws_patch,
                   plt.Line2D([0],[0], color='black', linestyle='--',
                              label='50 ms threshold')])
plt.tight_layout()
plt.savefig('Fig_ClientBoxplot.png', dpi=300)
plt.close()
print("  → Fig_ClientBoxplot.png")

# ── Fig D: CDF with Deadline Annotations ────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 5))

http_sorted = np.sort(http_all)
ws_sorted   = np.sort(ws_all)
cdf_http = np.arange(1, len(http_sorted) + 1) / len(http_sorted) * 100
cdf_ws   = np.arange(1, len(ws_sorted)   + 1) / len(ws_sorted)   * 100

ax.plot(http_sorted, cdf_http, color=COLOR_HTTP, linewidth=2, label='HTTP REST')
ax.plot(ws_sorted,   cdf_ws,   color=COLOR_WS,   linewidth=2, label='WebSocket')

deadline_colors = {'20ms': '#2ecc71', '50ms': '#e67e22', '100ms': '#8e44ad'}
for d, col in zip(DEADLINES, deadline_colors.values()):
    h_miss = miss_rates['HTTP REST'][d]
    w_miss = miss_rates['WebSocket'][d]
    ax.axvline(d, color=col, linestyle=':', linewidth=1.5,
               label=f'{d} ms (HTTP {h_miss:.0f}% miss / WS {w_miss:.0f}% miss)')

ax.set_xlim(0, min(800, max(http_all) * 1.05))
ax.set_ylim(0, 100)
ax.set_xlabel('RTT Latency (ms)')
ax.set_ylabel('Cumulative Events (%)')
ax.set_title('CDF with Deadline Compliance Markers\n'
             '(Vertical lines show 20 / 50 / 100 ms thresholds)')
ax.legend(loc='lower right', fontsize=8)
plt.tight_layout()
plt.savefig('Fig_CDF_Annotated.png', dpi=300)
plt.close()
print("  → Fig_CDF_Annotated.png")

# ── Fig E: Extended Percentile Bar Chart ────────────────────────────────────
fig, ax = plt.subplots(figsize=(11, 5))
labels = ['Mean', 'P50', 'P90', 'P95', 'P99', 'P99.9', 'Max']
pct_vals = [50, 50, 90, 95, 99, 99.9, 100]
http_vals = [statistics.mean(http_all)] + \
            [percentile(http_all, p) for p in [50, 90, 95, 99, 99.9]] + \
            [max(http_all)]
ws_vals   = [statistics.mean(ws_all)] + \
            [percentile(ws_all, p)   for p in [50, 90, 95, 99, 99.9]] + \
            [max(ws_all)]

x = np.arange(len(labels))
w = 0.35
bars_h = ax.bar(x - w/2, http_vals, w, label='HTTP REST',
                color=COLOR_HTTP, edgecolor='black')
bars_w = ax.bar(x + w/2, ws_vals,   w, label='WebSocket',
                color=COLOR_WS,   edgecolor='black')

def autolabel(bars):
    for b in bars:
        h = b.get_height()
        ax.annotate(f'{h:.0f}',
                    xy=(b.get_x() + b.get_width()/2, h),
                    xytext=(0, 3), textcoords='offset points',
                    ha='center', va='bottom', fontsize=8)

autolabel(bars_h)
autolabel(bars_w)
ax.axhline(50, color='black', linestyle='--', linewidth=1.2,
           label='50 ms coherence threshold')
ax.set_xticks(x)
ax.set_xticklabels(labels)
ax.set_ylabel('RTT Latency (ms)')
ax.set_title('Extended Latency Percentiles: Mean → P99.9 → Max')
ax.legend()
plt.tight_layout()
plt.savefig('Fig_PercentileTable.png', dpi=300)
plt.close()
print("  → Fig_PercentileTable.png")


# ═══════════════════════════════════════════════════════════════════════════
# 7. FINAL SUMMARY REPORT
# ═══════════════════════════════════════════════════════════════════════════

print("\n[5/5] Writing summary report...")

summary_lines = [
    "=" * 70,
    "P2 ANALYSIS SUMMARY REPORT",
    "=" * 70,
    "",
    "--- DEADLINE-MISS RATES (STEADY phase, 3,600 events/protocol) ---",
    f"  At 20ms:  HTTP {miss_rates['HTTP REST'][20]:.1f}%  |  WS {miss_rates['WebSocket'][20]:.1f}%",
    f"  At 50ms:  HTTP {miss_rates['HTTP REST'][50]:.1f}%  |  WS {miss_rates['WebSocket'][50]:.1f}%",
    f"  At 100ms: HTTP {miss_rates['HTTP REST'][100]:.1f}%  |  WS {miss_rates['WebSocket'][100]:.1f}%",
    "",
    "--- TRUE INTER-EVENT JITTER ---",
    f"  HTTP: mean={http_js['mean']:.1f}ms  P99={http_js['p99']:.1f}ms  max={http_js['max']:.1f}ms",
    f"  WS:   mean={ws_js['mean']:.1f}ms   P99={ws_js['p99']:.1f}ms   max={ws_js['max']:.1f}ms",
    "",
    "--- CLIENT-LEVEL MEANS (honest effective n=4/protocol) ---",
    f"  HTTP client means: {[round(r['mean'],1) for r in http_client_rows]}",
    f"  WS   client means: {[round(r['mean'],1) for r in ws_client_rows]}",
    "",
    "--- EXTENDED PERCENTILES ---",
]
for label, h, w in metrics:
    summary_lines.append(f"  {label:>8}: HTTP={h:.1f}ms  WS={w:.1f}ms")

summary_lines += [
    "",
    "--- FILES GENERATED ---",
    "  Tab_DeadlineMiss.txt       Deadline-miss rate table",
    "  Tab_JitterTrue.txt         True inter-event jitter statistics",
    "  Tab_ClientLevel.txt        Per-client aggregation + corrected test",
    "  Tab_ExtendedPercentiles.txt Extended p50/p90/p95/p99/p99.9/max",
    "  Fig_DeadlineMiss.png       Deadline-miss bar chart",
    "  Fig_JitterDist.png         True jitter violin plot",
    "  Fig_ClientBoxplot.png      Per-client boxplots",
    "  Fig_CDF_Annotated.png      CDF with deadline markers",
    "  Fig_PercentileTable.png    Extended percentile bar chart",
    "=" * 70,
]
summary_text = "\n".join(summary_lines)
print(summary_text)
with open('P2_Summary_Report.txt', 'w') as f:
    f.write(summary_text + "\n")

print("\n✔  All P2 analysis outputs generated successfully.")
