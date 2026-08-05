#!/usr/bin/env bash
# =============================================================================
# run_grid.sh — Network Condition Grid Experiment
# =============================================================================
# Runs the latency test for each cell in the delay × loss matrix,
# using Linux tc netem to emulate adverse network conditions on the
# outgoing network interface (same role as Clumsy on Windows).
#
# Grid: delay ∈ {0, 20, 50, 100} ms
#       loss  ∈ {0, 0.5, 1, 3}  %
#       → 16 combinations × 2 protocols = 32 test runs
#
# Prerequisites:
#   sudo privileges (for tc netem)
#   node latencia_test_grid.js in the same directory
#   npm packages: axios, socket.io-client
#
# Usage:
#   chmod +x run_grid.sh
#   ./run_grid.sh
#
# Output:
#   grid/grid_d{delay}_l{loss}_http.csv
#   grid/grid_d{delay}_l{loss}_ws.csv
#   grid/grid_run.log
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────
SERVER_URL="https://pianoflowbackend.onrender.com"
IFACE="wlp2s0"                 # Network interface (auto-detected below if wrong)
GRID_DIR="grid"
LOG_FILE="${GRID_DIR}/grid_run.log"

DELAYS=(0 20 50 100)           # milliseconds
LOSSES=(0 0.5 1 3)             # percent

# ── Auto-detect interface if needed ──────────────────────────────────────
DETECTED_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
if [[ -n "$DETECTED_IFACE" ]]; then
    IFACE="$DETECTED_IFACE"
fi

# ── Setup ─────────────────────────────────────────────────────────────────
mkdir -p "$GRID_DIR"
echo "" > "$LOG_FILE"

total=$((${#DELAYS[@]} * ${#LOSSES[@]}))
cell=0

echo "============================================================"
echo " NETWORK CONDITION GRID EXPERIMENT"
echo "============================================================"
echo "  Server  : $SERVER_URL"
echo "  Interface: $IFACE"
echo "  Grid    : ${#DELAYS[@]} delays × ${#LOSSES[@]} losses = $total cells"
echo "  Output  : ./$GRID_DIR/"
echo "============================================================"
echo ""

# ── TC helper functions ────────────────────────────────────────────────────
apply_tc() {
    local delay_ms=$1
    local loss_pct=$2

    # Remove any existing qdisc first (ignore error if none exists)
    sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true

    if [[ "$delay_ms" -eq 0 && $(echo "$loss_pct == 0" | bc -l) -eq 1 ]]; then
        echo "    [tc] No emulation (baseline)"
        return
    fi

    local tc_cmd="sudo tc qdisc add dev $IFACE root netem"
    if [[ "$delay_ms" -gt 0 ]]; then
        tc_cmd+=" delay ${delay_ms}ms 5ms distribution normal"
    fi
    if [[ $(echo "$loss_pct > 0" | bc -l) -eq 1 ]]; then
        tc_cmd+=" loss ${loss_pct}%"
    fi

    echo "    [tc] $tc_cmd"
    eval "$tc_cmd"
}

cleanup_tc() {
    sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true
    echo "    [tc] Conditions cleared."
}

# Ensure cleanup on exit
trap cleanup_tc EXIT

# ── Main grid loop ─────────────────────────────────────────────────────────
START_TIME=$(date +%s)

for delay in "${DELAYS[@]}"; do
    for loss in "${LOSSES[@]}"; do
        cell=$((cell + 1))
        prefix="${GRID_DIR}/grid_d${delay}_l${loss//./_}"
        label="d=${delay}ms l=${loss}%"

        echo "──────────────────────────────────────────────────"
        echo "  Cell ${cell}/${total}: ${label}"
        echo "──────────────────────────────────────────────────"
        echo "$(date '+%H:%M:%S') START cell ${cell}/${total}: delay=${delay}ms loss=${loss}%" >> "$LOG_FILE"

        # Apply network conditions
        apply_tc "$delay" "$loss"

        # Pause briefly so tc rule stabilizes
        sleep 1

        # Run the parametrized test
        node latencia_test_grid.js "$SERVER_URL" "$delay" "$loss" "$prefix" 2>&1 | tee -a "$LOG_FILE"

        # Clear conditions before next cell
        cleanup_tc

        # Inter-cell pause (let connections settle)
        sleep 2

        ELAPSED=$(( $(date +%s) - START_TIME ))
        REMAINING=$(( (total - cell) * ELAPSED / cell ))
        echo "  Elapsed: ${ELAPSED}s | Est. remaining: ${REMAINING}s"
        echo "$(date '+%H:%M:%S') END   cell ${cell}/${total}" >> "$LOG_FILE"
        echo ""
    done
done

echo "============================================================"
echo " GRID EXPERIMENT COMPLETE"
echo "============================================================"
echo "  Total cells: $total"
echo "  Output files in: ./$GRID_DIR/"
echo "  Total time: $(( $(date +%s) - START_TIME ))s"
echo ""
echo "  Next step:"
echo "    source venv/bin/activate && python3 analisis_grid.py"
echo "============================================================"
