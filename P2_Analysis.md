# P2 — Situational Analysis: Article, Feedback, and Requirements
> Based on: MolinaArticle.pdf, Articlefeedback.md, instruccionesarticleP2_en.txt
> Date: 2026-08-03 | Deadline: 2026-08-05, 12:00 (≈ 40 hours remaining)

---

## 1. What the current article (P1) actually claims

The article makes three central claims:

1. **≤50ms is the musical coherence threshold** (stated in the abstract and introduction).
2. **WebSocket is the only viable protocol** for real-time musical synchronization under adverse conditions.
3. **The decisive metric is maximum latency (jitter), not the mean.**

The experiment ran: 4 concurrent clients × 25 events/s = 100 MIDI events/s, over a single adverse condition (50ms lag + 1% packet loss), collecting 3,600 steady-state samples per protocol.

**Results from Table 2 (as extracted from PDF):**
- HTTP REST mean: **142.13 ms** | max: **1,318 ms**
- WebSocket mean: **176.35 ms** | max: **580 ms**
- T = 23.60, df = 7,179, p < 0.0001

---

## 2. The core contradiction the professor identified

> "Strong data volume, but the statistical inference and the main conclusion don't match the stated musical requirement, nor the metrics used." — Geovanny

**The logical inconsistency:** If ≤50ms is defined as the coherence threshold, then **both protocols fail**. The means are 142ms and 176ms — roughly 3× over the stated threshold. Concluding "WebSocket is the only viable protocol" doesn't hold under the paper's own standard. At best, WebSocket fails *less severely*.

This is not a wording problem — it's a structural logical gap between the abstract, results, and conclusion that has to be resolved with actual new analysis.

---

## 3. The four scientific issues flagged (prioritized)

### 🔴 HIGH — Deadline-miss rate framing (requires new analysis on existing data)
The paper reports means and maximums. The professor wants to know: **what % of individual events exceeded each latency deadline (20ms / 50ms / 100ms)?**
- This reframes the question from "which protocol has a lower number" to "which protocol actually delivers notes on time."
- **Can be computed from existing CSVs** without new experiments.
- Becomes the new headline result table.

### 🔴 HIGH — Jitter definition is wrong (requires new calculation on existing data)
The paper equates "maximum latency" with "jitter." These are different:
- **Max latency** = single worst observed value.
- **Jitter (correct)** = variation between consecutive events: |latency[i] − latency[i-1]|.
- A protocol can have low max but high jitter, or high max but smooth delivery otherwise.
- **Computable from the existing CSVs** — no new experiment needed, just new analysis.
- Must also fix every place the paper uses "jitter" incorrectly (abstract, section 6.1 heading, conclusions).

### 🔴 HIGH — Statistical independence assumption is violated (requires reanalysis)
Welch's t-test on 3,600 observations assumes independence. But all events come from 4 clients running continuously — observations are **autocorrelated** (network state at t affects t+1).
- The "effective sample size" is closer to **4** (one per client run), not 3,600.
- The reported T=23.6 and p<0.0001 are likely inflated.
- **Fix:** Aggregate to run/client level (4 data points per protocol), run a honest test on those, OR use block bootstrap / mixed-effects model.
- This changes Table 4 and the "H₀ is rejected" language throughout.

### 🔴 HIGH — Single adverse condition tested (requires new experiments)
The entire paper generalizes from **one point**: {50ms lag, 1% loss}. The professor wants a **grid**:
- Delay: {0, 20, 50, 100ms} × Loss: {0, 0.1, 1, 3%} = up to 16 combinations
- This is the most time-consuming piece — needs new Clumsy-controlled runs.
- Even a reduced 3×3 grid covering best/original/worst gives a much stronger result.
- Becomes a heatmap of deadline-miss rates (the "operating region map").

### 🟡 MEDIUM — Transport layer not verified (requires packet capture)
Section 3.2 literally contains the word "**Hypothetical**" in its subheading about HTTP's connection behavior.
- Does axios actually open a new TCP connection per request, or reuse keep-alive?
- Does Socket.IO add heartbeat/reconnect overhead affecting the numbers?
- **Fix:** Run Wireshark/tcpdump during a test run. Attach the PCAP to the evidence ZIP.
- This makes Section 3.2 go from "Hypothetical flow" → "Verified flow."

### 🟡 MEDIUM — No WAN test (new experiment, lower priority)
All tests ran on a single LAN with Clumsy emulating adversity. At least one run against a real separate host (the Render.com backend may already be remote) would add external validity.
- Given the 40-hour window, this is worth doing if the network grid is finished first.

### 🟢 LOW — Alternative protocols (can be justified textually)
WebRTC DataChannel / WebTransport as baselines. The professor said "or explicitly justify not doing so" — and the article already mentions WebTransport in Future Work. A strong justification paragraph is a legitimate and realistic path here given the timeline.

---

## 4. What the P2 instructions explicitly require

Cross-referencing `instruccionesarticleP2_en.txt` against the feedback:

| P2 Requirement | Status | Comment |
|---|---|---|
| Corrected + strengthened version of P1 | ❌ Not yet | The logical gap is still present |
| Real evidence, not rewording | ❌ Critical | Wording-only fix is **explicitly forbidden** |
| Sufficient number of executions/samples | ⚠️ Partial | 3,600 total but from only 4 correlated clients |
| Correct use of statistical analysis | ❌ Needs fix | Independence assumption violated |
| Tables and graphs for analysis | ⚠️ Partial | Missing jitter distribution, deadline table |
| Comparison with related work | ✅ Good | Related work section is solid |
| Identification of limitations/threats | ✅ Good | Section 6.4 already exists and is decent |
| Coherence between results/discussion/conclusions | ❌ Needs fix | Core contradiction in viability claim |
| Reference/DOI verification | ✅ Done | Verified in previous session (refs 9, 11, 12 fixed) |
| Updated public repository | ⚠️ Check | Repo is public but may need new data/scripts |
| Evidence ZIP with README.txt | ❌ Not yet | Must be created |

---

## 5. My deductions and strategic read of the situation

### 5.1 The "good news" about your data
You already have 3,600 × 2 = 7,200 latency measurements in CSV format. The **deadline-miss rate** and **proper jitter calculation** are **pure analysis tasks** on data you already own. This is probably 2-3 hours of Python work in `generar_graficos.py` — not new experiments.

### 5.2 The deadline-miss reframe is actually good for your paper
Reporting "X% of events exceeded 50ms" is a *stronger* result than reporting a mean, because it directly answers the musical coherence question. Under this lens, WebSocket will almost certainly win at the 50ms and 100ms thresholds even if neither "passes" the strict 50ms bar — which lets you write a much more nuanced and scientifically honest conclusion without abandoning the core finding.

### 5.3 The statistical fix is non-trivial but also not catastrophic
Aggregating to 4 data points per protocol and running a t-test or Mann-Whitney will give you lower statistical confidence, but the difference between 580ms max and 1,318ms max is so extreme that there's almost certainly still a real effect even with only 4 data points per protocol. Your T-value will drop dramatically, but the conclusion probably survives — just with more honest language about the small effective sample size.

### 5.4 The network grid is the hardest but most impactful change
Running 9–16 condition combinations is the thing that most directly addresses the "single condition generalization" problem. Even a 2×3 grid (3 delay levels × 2 loss levels = 6 conditions) would be a significant improvement. Given 40 hours and that your `latencia_test.js` script already works, this is feasible if you script the Clumsy configurations.

### 5.5 The PCAP is low-hanging fruit that adds credibility
Running tcpdump for a few minutes while `latencia_test.js` executes is fast. The result gives you verifiable evidence that turns the "Hypothetical" label into "Verified" — which looks much better in a scientific paper.

### 5.6 The bibliography is now clean
The corrections from the previous session (refs [9], [11], [12]) are already incorporated in the current PDF. DOI verification is done and passes the P2 checklist.

---

## 6. Suggested priority order given ~40 hours

1. **[~3h] Recompute analysis on existing data:**
   - Deadline-miss rates at 20/50/100ms per protocol
   - True inter-event jitter distribution
   - Run/client-level aggregation for the statistical test
   - → New table + new figure(s) → update Results, Discussion, Conclusions

2. **[~4-6h] New network condition grid:**
   - Script Clumsy configs for at least 2×3 conditions
   - Run `latencia_test.js` for each, collect new CSVs
   - → Heatmap of deadline-miss rates → update Methodology and Results

3. **[~1h] Packet capture:**
   - Run tcpdump during one test session
   - Verify TCP handshake count (HTTP) and Socket.IO heartbeat frames
   - → Convert "Hypothetical" → "Verified" in Section 3.2

4. **[~1h] WAN test (if time allows):**
   - Run against the live Render.com deployment
   - One comparative data point is enough

5. **[~2-3h] Prose rewrite (last, after all data is ready):**
   - Replace "only viable protocol" with conditional/compliance language
   - Update abstract, contribution statement, conclusions
   - Ensure full consistency pass across all sections

6. **[~1h] Evidence ZIP preparation:**
   - Organize CSVs, scripts, PCAP, graphs with a README.txt

---

## 7. One thing I'd flag as a risk

The most tempting shortcut is to rewrite the conclusions first to sound more nuanced, and then claim the evidence supports it. The P2 instructions **explicitly forbid this** — a "wording-only correction is insufficient when the observation requires new tests or analysis." The professor will check whether the new evidence actually exists in the ZIP. The order has to be: **data first, prose last**.
