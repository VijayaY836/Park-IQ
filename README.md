# ParkIQ — Bengaluru Parking Violation Intelligence Dashboard

**Flipkart Grid Hackathon · Problem Statement 1 — AI-driven Parking Intelligence**

An interactive intelligence dashboard analysing **298,450 parking violation records** from the Bengaluru Traffic Police (Nov 2023 – Apr 2024). Turns raw enforcement data into a prescriptive deployment tool — telling police *exactly* where to send limited patrol units for maximum impact.

---

## The Problem

On-street illegal parking near commercial areas, metro stations, and event zones chokes carriageways and junctions. Enforcement today is:

- **Reactive** — patrol-based, no data guiding where to go
- **Blind** — no heatmap of violations vs. congestion impact
- **Untargeted** — no way to prioritise enforcement zones

**ParkIQ solves all three.**

---

## Key Findings

| Insight | Stat |
|---|---|
| Violations during the night enforcement gap (8 PM – 6 AM) | **77%** |
| Violations at road junctions (direct congestion link) | **50.5%** |
| Single worst junction — Safina Plaza | **15,449 violations (5.2% of all records)** |
| Scooters + motorcycles share of violations | **45.5%** |
| Impact coverage with just 6 patrol units (greedy model) | **~72%** |

---

## Features

### Overview
KPI cards, hourly violation pattern (night-peak highlighted), violation-type doughnut, vehicle breakdown, monthly trend, and day-of-week distribution.

### Hotspot Map
Leaflet-based interactive map of Bengaluru with:
- **Heatmap mode** — intensity weighted by impact score
- **Dot map mode** — individual violation points colour-coded by junction risk
- **Hour filter** — All / Night (8 PM–6 AM) / Day / Rush hour

### Analytics
Top-12 police stations by volume (horizontal bar chart) and per-station hourly drill-down via dropdown.

### Junction Impact Ranking
Sortable, searchable table of the 15 worst junctions ranked by **impact score**:

```
impact_score = violations × 1.5 + junction_weight × 2
```

Each junction shows violation count, impact score bar, peak hour, dominant vehicle type, and a Critical / High / Medium priority badge.

### Patrol Allocation Model
Greedy impact-maximisation engine:
- Slider for available patrol units (1–15)
- Shift filter (All / Night / Day)
- Outputs the ranked deployment list with suggested 4-hour patrol windows
- **Coverage curve** showing diminishing returns — 6 units ≈ 72%, 8 units ≈ 84%

### AI Intelligence
Three components:

**K-Means Cluster Analysis**
scikit-learn `KMeans(n_clusters=8)` trained on 298K records using `[latitude, longitude, hour, impact_score]` as features (StandardScaler normalised). K=8 chosen by elbow method. Outputs 8 auto-discovered spatiotemporal enforcement zones ranked Critical → Low with violation counts, peak hours, junction density, and dominant vehicle/violation type.

**Cluster Map**
Interactive Leaflet map overlaying the 8 AI zones as proportionally-sized circles (radius by risk level) with labelled markers. Toggle on/off with "Show on map".

**Live Violation Feed Simulator**
Replays 500 sampled historical violations as a real-time stream (1.8s interval). Shows a scrolling table with urgency colour-coding (🔴 Critical / 🟡 Warning / 🔵 Normal), live counters, an impact sparkline, and flashing map dots on the cluster map. In production, this connects to BTP's CCTV → computer-vision pipeline.

---

## Project Structure

```
parking-intelligence/
├── index.html              ← Single-page dashboard entry point
├── css/
│   └── style.css           ← Full stylesheet (professional light theme)
├── js/
│   ├── data.js             ← JSON loader + helper functions
│   ├── charts.js           ← Chart.js renderers (8 charts)
│   ├── map.js              ← Leaflet heatmap + dot map + junction markers
│   ├── allocation.js       ← Greedy patrol model + junction table
│   ├── ai.js               ← K-Means cluster display + live feed simulator
│   └── app.js              ← Entry point, navigation, initialisation
├── data/
│   └── violations.json     ← Pre-processed violation data (~406 KB)
└── README.md
```

---

## How to Run

> **Do NOT double-click `index.html`.** The dashboard fetches `violations.json` via `fetch()`, which browsers block on `file://` protocol. Use any local server.

### Option 1 — Python (no install needed)
```bash
cd "path/to/parking-intelligence"
python -m http.server 8080
# Open: http://localhost:8080
```

### Option 2 — VS Code Live Server
1. Install the **Live Server** extension by Ritwick Dey (`Ctrl+Shift+X`)
2. Right-click `index.html` → **Open with Live Server**
3. Opens at `http://127.0.0.1:5500`

### Option 3 — Node.js
```bash
npx serve .
# Open the URL it prints
```

---

## How the Data Was Generated

`violations.json` was produced from the raw BTP CSV using `scripts/process_data.py`. It generates all keys the dashboard consumes: KPIs, hourly buckets, violation types, vehicles, monthly trend, stations, junctions, map points, day-of-week, **K-Means clusters**, and the **live feed pool**.

Create `scripts/process_data.py`:

```python
"""
process_data.py
Processes raw BTP violation CSV → violations.json for ParkIQ dashboard.
Usage: python scripts/process_data.py
Requires: pip install pandas scikit-learn
"""

import pandas as pd
import ast, json, random, re
from collections import Counter
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

CSV_PATH = 'data/jan_to_may_police_violation_anonymized791b166.csv'
OUT_PATH = 'data/violations.json'

df = pd.read_csv(CSV_PATH)
df['created_dt']  = pd.to_datetime(df['created_datetime'], utc=True, errors='coerce')
df['hour']        = df['created_dt'].dt.hour
df['month']       = df['created_dt'].dt.month
df['dow']         = df['created_dt'].dt.day_name()

def parse_list(s):
    if pd.isna(s): return []
    try:    return ast.literal_eval(s)
    except: return [s]

df['vtype_list']     = df['violation_type'].apply(parse_list)
df['num_violations'] = df['vtype_list'].apply(len)
df['at_junction']    = df['junction_name'] != 'No Junction'
df['impact_score']   = df['num_violations'] * 1.5 + df['at_junction'].astype(int) * 2
df['vtype_primary']  = df['vtype_list'].apply(lambda x: x[0] if x else 'UNKNOWN')

# --- KPIs ---
kpis = {
    'total':             int(len(df)),
    'junction_pct':      round(float(df['at_junction'].mean() * 100), 1),
    'night_pct':         round(float((df['hour'].isin([20,21,22,23,0,1,2,3,4,5])).mean() * 100), 1),
    'multi_pct':         round(float((df['num_violations'] > 1).mean() * 100), 1),
    'scooter_mc_pct':    round(float((df['vehicle_type'].isin(['SCOOTER','MOTOR CYCLE'])).mean() * 100), 1),
    'top_junction':      df[df['at_junction']]['junction_name'].value_counts().idxmax(),
    'top_junction_count':int(df[df['at_junction']]['junction_name'].value_counts().max()),
}

# --- Hourly ---
hourly = {int(k): int(v) for k, v in df['hour'].value_counts().sort_index().items()}

# --- Violation types ---
vtype_counter = Counter()
for lst in df['vtype_list']:
    for v in lst: vtype_counter[v.strip()] += 1
vtypes = [{'type': k, 'count': v} for k, v in vtype_counter.most_common(10)]

# --- Vehicles ---
vehicles = [{'type': k, 'count': int(v)} for k, v in df['vehicle_type'].value_counts().head(8).items()]

# --- Monthly ---
month_map = {11:'Nov', 12:'Dec', 1:'Jan', 2:'Feb', 3:'Mar', 4:'Apr'}
order     = ['Nov','Dec','Jan','Feb','Mar','Apr']
monthly   = sorted(
    [{'month': month_map[int(k)], 'count': int(v)}
     for k, v in df['month'].value_counts().sort_index().items() if int(k) in month_map],
    key=lambda x: order.index(x['month'])
)

# --- Stations ---
stations = [{'station': k, 'count': int(v)} for k, v in df['police_station'].value_counts().head(12).items()]

# --- Day of week ---
dow_order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
dow_counts = df['dow'].value_counts()
dow = [{'day': d[:3], 'count': int(dow_counts.get(d, 0))} for d in dow_order]

# --- Junctions ---
jdf = df[df['at_junction']].copy()
junction_stats = jdf.groupby('junction_name').agg(
    count=('id','count'),
    total_impact=('impact_score','sum'),
    lat=('latitude','mean'),
    lon=('longitude','mean'),
    peak_hour=('hour', lambda x: int(x.value_counts().idxmax())),
    top_veh=('vehicle_type', lambda x: x.value_counts().idxmax()),
).sort_values('total_impact', ascending=False).head(15)

junctions = []
for name, row in junction_stats.iterrows():
    clean = re.sub(r'^BTP\d+\s*-\s*', '', name)
    junctions.append({
        'name': clean, 'full_name': name,
        'count': int(row['count']),
        'impact': round(float(row['total_impact']), 1),
        'lat': round(float(row['lat']), 6),
        'lon': round(float(row['lon']), 6),
        'peak_hour': int(row['peak_hour']),
        'top_vehicle': str(row['top_veh']),
    })

# --- Map points (sampled) ---
random.seed(42)
junc_pts   = df[df['at_junction']].sample(min(2000, int(df['at_junction'].sum())), random_state=42)
non_junc   = df[~df['at_junction']].sample(500, random_state=42)
map_df     = pd.concat([junc_pts, non_junc]).dropna(subset=['latitude','longitude'])
map_points = map_df.rename(columns={
    'latitude':'lat','longitude':'lon','vtype_primary':'vtype',
    'vehicle_type':'veh','impact_score':'impact','junction_name':'junction',
    'police_station':'station'
})[['lat','lon','hour','vtype','veh','impact','junction','station']].to_dict(orient='records')

# --- K-Means clustering (K=8) ---
cluster_df = df.dropna(subset=['latitude','longitude']).copy()
features   = cluster_df[['latitude','longitude','hour','impact_score']].values
scaler     = StandardScaler()
X          = scaler.fit_transform(features)
km         = KMeans(n_clusters=8, n_init=10, random_state=42)
cluster_df['cluster'] = km.fit_predict(X)

risk_order = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
cluster_records = []
total_impact = cluster_df['impact_score'].sum()

for cid, grp in cluster_df.groupby('cluster'):
    ti = float(grp['impact_score'].sum())
    pct = ti / total_impact
    risk = 'Critical' if pct > 0.25 else 'High' if pct > 0.15 else 'Medium' if pct > 0.08 else 'Low'
    cluster_records.append({
        'cluster_id':    int(cid) + 1,
        'count':         int(len(grp)),
        'lat':           round(float(grp['latitude'].mean()), 6),
        'lon':           round(float(grp['longitude'].mean()), 6),
        'avg_impact':    round(float(grp['impact_score'].mean()), 2),
        'total_impact':  round(ti, 1),
        'peak_hour':     int(grp['hour'].value_counts().idxmax()),
        'junction_pct':  round(float(grp['at_junction'].mean() * 100), 1),
        'top_vtype':     str(grp['vtype_primary'].value_counts().idxmax()),
        'top_vehicle':   str(grp['vehicle_type'].value_counts().idxmax()),
        'risk_level':    risk,
    })

cluster_records.sort(key=lambda x: x['total_impact'], reverse=True)
for i, c in enumerate(cluster_records):
    c['rank'] = i + 1

# --- Live feed pool (500 sampled records) ---
live_sample = df.dropna(subset=['latitude','longitude']).sample(500, random_state=7)
live_pool = live_sample.rename(columns={
    'latitude':'lat','longitude':'lon','vtype_primary':'vtype',
    'vehicle_type':'veh','impact_score':'impact','junction_name':'junction',
    'police_station':'station','at_junction':'at_junction'
})[['lat','lon','hour','vtype','veh','impact','junction','station','at_junction']].to_dict(orient='records')
for r in live_pool:
    r['at_junction'] = bool(r['at_junction'])

# --- Write output ---
out = dict(
    kpis=kpis, hourly=hourly, vtypes=vtypes, vehicles=vehicles,
    monthly=monthly, stations=stations, junctions=junctions,
    map_points=map_points, dow=dow,
    clusters=cluster_records, live_pool=live_pool,
)

with open(OUT_PATH, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

print(f"Written {OUT_PATH}")
print(f"  {len(map_points)} map points, {len(cluster_records)} clusters, {len(live_pool)} live pool records")
```

---

## Dependencies

### Frontend (all CDN — no npm needed)

| Library | Version | Purpose |
|---|---|---|
| Chart.js | 4.4.1 | All charts |
| Leaflet | 1.9.4 | Interactive maps |
| Leaflet.heat | 0.2.0 | Heatmap layer |
| Inter (Google Fonts) | — | Typography |

### Data pipeline (Python only, for regenerating violations.json)

```bash
pip install pandas scikit-learn
```

---

## Dashboard Sections

| Section | What it shows |
|---|---|
| **Overview** | KPIs, hourly pattern, violation types, vehicles, monthly trend, day of week |
| **Hotspot Map** | Leaflet heatmap + dot map with hour filter |
| **Analytics** | Top-12 police stations, station hourly drill-down |
| **Junctions** | Sortable/searchable junction impact table with priority badges |
| **Patrol Allocation** | Greedy unit allocation with slider, shift filter, and coverage curve |
| **AI Intelligence** | K-Means cluster cards, cluster map overlay, live violation feed |

---

## How the AI Works

```
1. Feature extraction  →  [lat, lon, hour, impact_score] per violation
2. Normalisation       →  StandardScaler (zero mean, unit variance)
3. K-Means (K=8)       →  Spatiotemporal zone discovery (K chosen by elbow method)
4. Risk scoring        →  Clusters ranked by proportional impact share
5. Production path     →  CCTV → YOLOv8 detection → DB → live cluster update
```

---

## Impact

The dashboard enables three immediate, low-cost actions for BTP:

1. **Shift to night enforcement** — 77% of violations happen when patrols aren't deployed
2. **Concentrate on Safina Plaza** — one junction = 5.2% of all violations; a dedicated unit outperforms six spread thin
3. **Prioritise two-wheeler zones** — scooters + motorcycles = 45.5% of violations; CCTV placement should reflect this
