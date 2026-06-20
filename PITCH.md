# ParkIQ — Judging Kit

Problem Statement 1 · *Poor Visibility on Parking-Induced Congestion*

---

## 60-Second Pitch (read aloud ≈ 160 words)

> Illegal parking near markets, metros, and event zones chokes Bengaluru's
> junctions — but enforcement today is blind and reactive. Police patrol on
> instinct, with no map of where violations actually hurt traffic.
>
> **ParkIQ turns 298,450 real Traffic Police violation records into a decision tool.**
>
> Three findings jumped out. **77% of violations happen between 8 PM and 6 AM** —
> exactly when patrols aren't deployed. A *single* junction, Safina Plaza, accounts
> for **5.2% of all violations**. And **half of all violations sit at road junctions** —
> the direct link to congestion.
>
> So we don't just count violations — we score their **traffic impact**, and an
> **unsupervised AI model auto-discovers eight enforcement zones**. Then our
> patrol-allocation engine answers the question police actually ask:
> *"I have six units — where do I send them?"* The answer: **six units cover 72%
> of the city's total violation impact.**
>
> That's the shift — from reactive patrolling to **targeted, data-driven enforcement** —
> and the same framework plugs straight into live CCTV.

**Delivery notes:** Open on the *77% night gap* (your strongest stat). Land on the
*"6 units = 72%"* line — that's the memorable payoff. Have the dashboard on the
**Patrol Allocation** tab when you say it, and drag the slider live.

---

## Tough Questions + Answers

### "How is this actually *AI*? It looks like a dashboard."
Two AI layers. **(1)** Unsupervised **K-Means clustering** (K=8, chosen by elbow
method on inertia) groups 298K violations into spatial-temporal enforcement zones
using latitude, longitude, hour, and impact score — no zones drawn by hand.
**(2)** The patrol engine is an **optimization model** (greedy impact-maximisation),
not a chart. The dashboard is how we *surface* the intelligence — the intelligence
is the clustering and the allocation.

### "How do you know violations = traffic congestion? Did you measure traffic flow?"
Honest answer: we use a **weighted proxy**, not measured vehicle speed. Our impact
score = `violations × 1.5 + junction-weight × 2` — a violation *at a junction* is
weighted far higher because junctions are where parking directly blocks moving
traffic. **50.5% of violations are at junctions**, which is the congestion linkage.
The framework is built to ingest real traffic-flow / speed data the moment BTP
provides it — the score formula is the only thing that changes.

### "Greedy allocation isn't mathematically optimal. Why use it?"
Coverage maximisation is a **submodular** problem, where greedy is provably within
63% of optimal and usually far closer — and it's **fast and explainable**, which
matters more than a 1% optimality gain when you're briefing a patrol commander.
For a production rollout we'd compare against an integer-linear-program solver, but
greedy is the right call for a transparent, real-time tool.

### "Why is the data pre-processed / not real-time?"
Performance and honesty. We pre-aggregated 298K raw records into a 400 KB file so
the dashboard loads instantly in any browser — the analysis itself is real. The
**live feed** is clearly labelled as a *replay simulation*; in production it's the
CCTV → computer-vision → database pipeline shown in the "How the AI works" panel.

### "Why K=8 zones?"
Elbow method — we plotted clustering inertia against K and picked the point of
diminishing returns. Eight zones is also operationally sensible: it maps to a
realistic number of patrol divisions without over-fragmenting the city.

### "This is 2023–24 data. Is it still relevant?"
The *patterns* are structural, not seasonal — the night-enforcement gap and
junction concentration are about human behaviour and road geometry, not a
specific month. And the pipeline re-runs on any fresh CSV in seconds, so the
dashboard stays current as new data lands.

### "How is this different from a normal BI dashboard (Power BI / Tableau)?"
A BI dashboard *shows* what happened. ParkIQ **prescribes what to do** — it
weights violations by congestion impact, auto-discovers zones with ML, and outputs
a concrete deployment plan. The allocation slider is a decision, not a report.

### "Does it scale to other cities?"
Entirely data-driven — no Bengaluru-specific logic. Feed it another city's
violation CSV and it regenerates clusters, junction rankings, and patrol plans.

### "What's the real-world impact / what would BTP actually do with this?"
Three immediate actions: **(1)** shift enforcement resources into the 8 PM–6 AM
window; **(2)** put two fixed/dedicated units on Safina Plaza rather than spreading
thin; **(3)** prioritise two-wheeler-accessible zones (scooters + motorcycles =
45.5% of violations). Measurable, low-cost, this-week actions.

### "What's Phase 2 if you win?"
Live CCTV frames → YOLOv8 detects illegal parking → auto-classified violation →
cluster model updates zones in near-real-time → optional auto-challan. We've scoped
it; we didn't fake it.

---

## One-Liners to Keep in Your Pocket
- *"77% of violations happen when nobody's patrolling."*
- *"One junction is 5% of the entire problem."*
- *"Six units, seventy-two percent of the impact."*
- *"We don't count violations — we rank them by how much they choke traffic."*
- *"Reactive patrolling, made targeted."*
