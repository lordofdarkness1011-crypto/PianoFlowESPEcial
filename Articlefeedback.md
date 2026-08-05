I read the feedback spreadsheet. This is not polish — Geovanny is challenging the core scientific claim of your paper, and the P2 instructions explicitly require new evidence, not just rewording, wherever the feedback calls for it. Here's everything, translated and organized.

### **Yes, these are major changes**

Geovanny's diagnosis, translated directly: *"Strong data volume, but the statistical inference and the main conclusion don't match the stated musical requirement, nor the metrics used."*

The core problem: your abstract defines ≤50ms as the threshold for musical coherence. But your own Table 2 shows **both protocols have mean latencies well above that (142ms and 176ms)** — under your own stated standard, neither protocol actually works for real-time music. Your conclusion ("WebSocket is the only viable protocol") doesn't follow from your own data once you apply your own threshold. That's the central issue everything else radiates from.

### **The four things Geovanny flags as scientifically wrong**

1. **The viability claim contradicts your own threshold.** If ≤50ms is coherence and both means (142/176ms) blow past it, you can't conclude WebSocket is "viable" just because its max is lower than HTTP's max — you have to report that under this specific adverse condition, *neither* protocol meets the goal.  
2. **"Maximum latency" is not the same thing as "jitter."** Your paper treats them as interchangeable. Jitter is properly the variation between consecutive events (inter-event delay variation), not the single worst observed value. This needs an actual jitter calculation with its own definition and distribution, separate from the max.  
3. **Your Welch's t-test treats 3,600 events as independent — they're not.** Thousands of events from the same client/run are autocorrelated (each depends on network/queue state from the previous event). Running a naive t-test across all of them as if independent inflates statistical significance artificially. You need to either use run/client as the experimental unit, or use a method that accounts for the correlation (mixed-effects models or block bootstrap).  
4. **You never verified what actually happened at the transport layer.** Does your HTTP REST client actually reuse connections (keep-alive), or open a fresh one every time as your Scenario A description implies? Does Socket.IO add its own retry/heartbeat layer on top of raw WebSocket that's affecting your numbers? This needs to be checked with an actual packet capture, not assumed from the code.

### **What Geovanny wants the contribution reframed as**

Instead of "which protocol is viable," the paper should answer: **"under what network conditions does each protocol meet which latency deadline?"** — identifying operating regions rather than declaring an overall winner. He suggests defining deadline-miss rates at 20ms/50ms/100ms thresholds and reporting what percentage of events miss each one, per protocol, per network condition.

### **Full improvement table (translated)**

| Area | Finding | Required action | Expected evidence | Priority |
| ----- | ----- | ----- | ----- | ----- |
| Viability criterion | ≤50ms threshold contradicts current conclusion | Report deadline-miss rate at 20/50/100ms; state non-compliance explicitly where it occurs | Compliance table by protocol/condition | High |
| Jitter | Max latency used as a jitter proxy | Calculate actual inter-event jitter with an explicit definition | Jitter distribution \+ percentiles | High |
| Independence | Thousands of same-client events treated as independent | Use run/client as the experimental unit; mixed-effects model or block bootstrap | Corrected statistical inference | High |
| Network matrix | Only one adverse condition tested | Test delay {0,20,50,100ms} × loss {0,0.1,1,3%} (or equivalent grid) | Operating-region map | High |
| Transport behavior | Socket.IO layers over WebSocket; HTTP may reuse connections | Packet capture documenting handshake, keep-alive, retransmissions | PCAP \+ transport analysis | High |
| Queue metrics | Mean/max don't characterize tail behavior | Report p50/p95/p99/p99.9, loss rate, timeout/recovery | Distributions with confidence intervals | High |
| External validity | Clumsy-only, single-machine LAN | Add at least one real WAN test between separate hosts/locations | Lab vs. real-network comparison | Medium |
| Alternatives | No low-latency transport baseline | Compare WebRTC DataChannel/WebTransport/QUIC, or explicitly justify not doing so | Additional baseline or written justification | Medium |
| Writing | "Only viable" overstates the evidence | Reframe around trade-offs and compliance regions; separate statistical significance from musical relevance | Conclusions matched to deadline/effect data | High |

**Minimum required before rewriting Results/Conclusions**, per Geovanny:

1. Delay × loss matrix with deadline-miss rates and p99.  
2. Packet capture verifying keep-alive/handshake/retransmission behavior.  
3. Block/run-level statistical analysis plus one real WAN test.

**His closing bar**: the new version has to answer *which protocol meets which deadline under which condition* — not just which one has the lower mean or max.

### **What the P2 assignment (index 70\) additionally requires**

* **Real evidence, not rewording.** Explicitly states a wording-only fix is insufficient when the feedback calls for new tests or analysis — matches exactly what Geovanny is asking for.  
* **Full consistency pass**: if methodology/experiments change, abstract, results, graphs, discussion, and conclusions must all be updated to match — you can't fix Results without touching everything downstream of it.  
* **Reference/DOI verification is now an explicit grading criterion** ("revisión y verificación de referencias científicas y DOI").

Expanded:

Let's break this down properly — not just what to change, but why each piece exists and how it reshapes the paper's argument. I'll go point by point.

### **1\. The deadline-miss reframing (the central pivot)**

**What's wrong conceptually:** Your abstract states ≤50ms is the threshold for musical coherence. Your Results show mean latencies of 142ms (HTTP) and 176ms (WebSocket) — both roughly 3x over that threshold. Your Conclusion says WebSocket is "the only viable protocol." Those three things can't all be true at once. A reader who takes your own methodology seriously will conclude: *by the paper's own stated standard, neither protocol is viable under this network condition.*

**What "deadline-miss rate" means:** Instead of asking "what's the average latency," you ask "what percentage of individual note-events arrived late enough to break musical timing?" You pick concrete deadlines (e.g., 20ms — tight/professional threshold, 50ms — your stated coherence threshold, 100ms — loose/casual threshold) and for each protocol, report: *X% of events exceeded 20ms, Y% exceeded 50ms, Z% exceeded 100ms.* This is a completely different lens than mean/max — it directly answers "is this usable for real-time music" instead of "which number is smaller."

**How this changes the paper:** Your Results section needs a new table — protocol × deadline threshold × miss percentage. Your Discussion needs to stop saying "WebSocket wins" and start saying something like "at the 50ms threshold, WebSocket missed X% of deadlines and HTTP missed Y%, meaning under this adverse condition neither protocol reliably supports professional musical timing, though WebSocket degrades more gracefully." Your Conclusion's "only viable protocol" language has to go entirely — replaced by conditional language ("WebSocket is preferable under these conditions when the acceptable deadline is set at Xms, but neither meets a strict 50ms bar").

### **2\. Jitter is not the maximum — this needs an actual new calculation**

**What's wrong:** Your paper uses "maximum latency" and "jitter" as if they're the same thing (e.g., "reduced the maximum latency peaks (Lag spikes) by 56%" is described as a jitter reduction). They're not. Jitter, properly defined, is the **variation between consecutive events** — how much does the delay of event N differ from event N-1? A protocol could have a huge single spike (high max) but be very smooth otherwise (low jitter), or have no huge spikes but constantly fluctuate a little (low max, high jitter). Your paper currently can't distinguish these cases because you never computed the inter-event variation.

**What you need to compute:** For each protocol, take the sequence of latencies in time order, compute the absolute difference between each consecutive pair (|latency\[i\] − latency\[i-1\]|), and report the distribution of those differences — mean, percentiles, maybe standard deviation. This is a straightforward computation on your existing CSV data — you don't need a new experiment for this part, just new analysis on data you already have. It becomes a new table/figure in Results, and a corrected definition needs to replace every place the paper currently conflates "max" with "jitter" (abstract, intro, section headers like "6.1 Interpretation of the Mean-Maximum Paradox" might need renaming, discussion).

### **3\. Statistical independence — why your p-value might be inflated**

**What's wrong:** Welch's t-test assumes every one of your 3,600 observations per protocol is statistically independent of every other one. But your 3,600 samples come from only 4 clients running continuously — event \#501 from client 2 is not independent of event \#500 from client 2, because network conditions, queue state, and TCP behavior at time T influence what happens at time T+1. Treating 3,600 correlated observations as if they were 3,600 independent ones makes your test dramatically more confident than it should be — your reported p\<0.0001 and T=23.6 might look far stronger than reality, because the "effective sample size" is really closer to 4 (one per client/run), not 3,600.

**What fixes this (pick one, don't need all three):**

* **Simplest**: aggregate to the run/client level first — compute one summary statistic (e.g., mean latency, deadline-miss rate) *per client per condition*, giving you 4 data points per protocol instead of 3,600, then test on those. Much less statistical power, but honest.  
* **Mixed-effects model**: treat "client" as a random effect, letting the model account for the fact that observations cluster by client. More sophisticated, keeps more of your data's structure.  
* **Block bootstrap**: resample entire contiguous chunks of the time series (not individual points) to preserve the autocorrelation structure when estimating confidence intervals.

For a course-level paper, the block/run-level aggregation approach is probably the most tractable given your timeline. This replaces Table 4 (Welch's T-Test) and the "H₀ is rejected" framing in Results — you'll likely still find a real difference, but the statistical language needs to become much more careful and probably less dramatically confident.

### **4\. The network condition matrix — this is the part requiring new experiments**

**What's wrong:** You tested exactly one adverse condition (50ms \+ 1% loss) and generalized from it. Geovanny wants to see how each protocol behaves across a *range* of conditions, not one point.

**What this means concretely:** Instead of one run per protocol, you need something like: delay ∈ {0, 20, 50, 100ms} × loss ∈ {0, 0.1, 1, 3%} — that's potentially 16 combinations per protocol (4×4 grid), though you could reduce the grid size if 2 days doesn't allow full coverage (e.g., 3×3 \= 9 combinations, or even a smaller targeted set covering "best case," "your original condition," and "worst case"). Each combination needs enough iterations to be meaningful — you don't need 1,000 iterations per cell like your original design; even 100-200 per cell across 4 clients could work if you're honest about the reduced sample size.

**How this changes the paper:** This becomes your headline new result — instead of one bar chart, you get a heatmap or grid: rows \= delay levels, columns \= loss levels, cell values \= deadline-miss rate (or p99 latency) for each protocol. This is literally the "operating region map" Geovanny asked for as the expected deliverable. Your Methodology section 4.3 (Environment Configuration) needs to describe the full matrix design instead of a single condition. This is probably the single most time-consuming piece to execute given your window, so plan Clumsy scripting for this first.

### **5\. Verifying what's actually happening at the transport layer**

**What's wrong:** Your paper *asserts* things about HTTP connection reuse and Socket.IO's overhead without ever checking. Section 3.2 describes HTTP as establishing "a new TCP connection (3-way handshake)" per note "hypothetically" — the word "Hypothetical" is literally in your own subheading\! You never verified whether your axios client was actually reusing a keep-alive connection under the hood (Node's axios/http.Agent defaults matter here) or opening fresh ones. Similarly, you never verified what Socket.IO is doing on the wire beyond the raw WebSocket frame — heartbeats, reconnection attempts, protocol-level acks.

**What this requires:** Run Wireshark or tcpdump while your test script executes, capture the traffic (a .pcap file), and actually look at it — count TCP handshakes during the HTTP run (proving or disproving connection reuse), look for Socket.IO's engine.io ping/pong frames, check for TCP retransmissions during Clumsy's packet-loss injection. This becomes evidence, not just narrative — you attach the pcap (or a filtered/anonymized summary of it) to your evidence ZIP, and reference specific counts in the paper ("packet capture confirmed N TCP handshakes across N-1 note events, confirming/contradicting keep-alive reuse").

**How this changes the paper:** Section 3.2's "Hypothetical flow" framing needs to become "Verified flow" once you've checked it, and Discussion section 6.1 (which currently *assumes* the TCP Head-of-Line Blocking explanation) gets to become evidence-backed instead of theoretical.

### **6\. Tail latency metrics with confidence intervals**

**What's wrong:** You already added percentiles (P95, P99, P99.9) in Table 2, which is good, but you don't have confidence intervals around any of these estimates, and you don't report loss/timeout/recovery behavior explicitly as its own metric.

**What this requires:** Bootstrap confidence intervals around your percentile estimates (this is a computation on existing/new data, not a new experiment necessarily), plus explicit tracking of: how many requests timed out entirely (not just slow, but failed), and how long recovery took after a Clumsy-induced drop. This is naturally something you'll get almost for free once you're running the network matrix experiments in item 4, if you log timeouts/failures per condition.

### **7\. Real WAN test (Medium priority — do if time allows)**

**What's wrong:** Your entire experiment ran on one LAN with Clumsy software emulating adversity. That tells you nothing about real geographic distance, real ISPs, real jitter sources like actual router queuing.

**What this requires:** One test run between two genuinely separate machines/locations — e.g., your laptop at home vs. a cheap cloud VM in a different city/country, or your machine vs. a friend's on a different ISP. Doesn't need to be extensive — even one comparative run (same protocol test, real WAN instead of Clumsy-emulated LAN) gives you a "lab vs. real network" comparison paragraph in Discussion. Given your Render.com backend is presumably already hosted remotely, you may already have a natural WAN path available — worth checking if your existing deployment could serve as the "real" condition versus a fresh local Clumsy-emulated condition.

### **8\. Alternative low-latency transport comparison (Medium priority — or justify skipping)**

**What's wrong:** Geovanny suggests your discussion would be stronger with a baseline like WebRTC DataChannel or WebTransport/QUIC, since these exist specifically to solve TCP Head-of-Line Blocking (the exact problem your paper identifies as WebSocket's core limitation).

**Two paths:** (a) If time allows, add a third experimental scenario testing one of these transports under the same adverse conditions — this would be a substantial addition given your timeline. (b) More realistically given \~2 days: **write an explicit justification paragraph** explaining why this is out of scope (e.g., "implementing a third transport with equivalent Socket.IO-level room management and comparable client tooling was outside this iteration's scope; we treat this as the primary direction for future work" — which conveniently, you already sort of gesture at in your Future Work section on WebTransport/QUIC). Geovanny explicitly said "or justify exclusion," so option (b) is legitimate and much more realistic given your timeline.

### **9\. The writing-level fix (last step, after everything else is redone)**

Once all the above changes exist, the actual prose rewrite is mostly mechanical: replace "the only viable protocol" and similar absolute claims throughout (abstract, intro contribution statement, conclusion) with trade-off language tied to your new deadline-compliance data — something like "WebSocket maintains bounded, more predictable tail latency and lower deadline-miss rates under adverse conditions, while HTTP REST offers lower latency in low-loss conditions; neither fully satisfies a strict 50ms coherence threshold under the tested worst-case scenario." This has to wait until the new analysis exists — rewriting the conclusion first and backfilling evidence would be exactly the "wording-only fix" the P2 instructions explicitly forbid.

