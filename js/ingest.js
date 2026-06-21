/* js/ingest.js — browser-side CSV ingestion + processing pipeline */

/* ---- Seeded random (LCG) for reproducible K-Means ---- */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

/* ---- Parse Python-style list strings ----
   e.g. "['WRONG PARKING', 'NO PARKING']" → ['WRONG PARKING', 'NO PARKING']
*/
function parseVtypeStr(str) {
  if (!str || str === 'nan' || str === '') return [];
  try {
    return JSON.parse(str.replace(/'/g, '"'));
  } catch (_) {
    const matches = str.match(/'([^']+)'/g);
    if (matches) return matches.map(m => m.replace(/'/g, '').trim());
    const bare = str.replace(/[\[\]]/g, '').trim();
    return bare ? [bare] : [];
  }
}

function parseHour(dtStr) {
  if (!dtStr) return null;
  const m = dtStr.match(/[T\s](\d{2}):/);
  return m ? parseInt(m[1], 10) : null;
}

function parseMonth(dtStr) {
  if (!dtStr) return null;
  const m = dtStr.match(/\d{4}-(\d{2})-/);
  return m ? parseInt(m[1], 10) : null;
}

function parseDow(dtStr) {
  if (!dtStr) return null;
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const d = new Date(dtStr);
  return isNaN(d) ? null : DAYS[d.getDay()];
}

/* ---- Wrap PapaParse in a Promise ---- */
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: r => resolve(r.data),
      error:    e => reject(new Error(e.message)),
    });
  });
}

/* ---- K-Means (K=8, seeded) ---- */
function kMeans(pts, k, iters, rng) {
  /* pts: [{x,y,z,w}] normalised */
  const dist2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

  /* k-means++ init */
  const centroids = [pts[Math.floor(rng() * pts.length)]];
  while (centroids.length < k) {
    const dists = pts.map(p => Math.min(...centroids.map(c => dist2(p, c))));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let ci = 0;
    while (ci < dists.length - 1 && r > dists[ci]) r -= dists[ci++];
    centroids.push(pts[ci]);
  }

  let assignments = new Array(pts.length).fill(0);
  for (let iter = 0; iter < iters; iter++) {
    assignments = pts.map(p => {
      let best = 0, bestD = dist2(p, centroids[0]);
      for (let c = 1; c < k; c++) {
        const d = dist2(p, centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    });
    for (let c = 0; c < k; c++) {
      const members = pts.filter((_, i) => assignments[i] === c);
      if (!members.length) continue;
      centroids[c] = members[0].map((_, d) =>
        members.reduce((s, m) => s + m[d], 0) / members.length
      );
    }
  }
  return assignments;
}

function normalise(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std  = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length) || 1;
  return arr.map(v => (v - mean) / std);
}

function sample(arr, n, rng) {
  if (arr.length <= n) return [...arr];
  /* deterministic stride sample */
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

/* ---- Aggregate helpers ---- */
const r1 = n => Math.round(n * 10) / 10;
const r2 = n => Math.round(n * 100) / 100;
const r6 = n => Math.round(n * 1e6) / 1e6;
const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const mode = arr => {
  const c = {};
  arr.forEach(v => { c[v] = (c[v] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
};

/* ---- Main processing function ---- */
function processCSV(rows) {
  const rng = makeRng(42);

  /* Normalise column names (trim whitespace) */
  const norm = rows.map(r => {
    const o = {};
    Object.keys(r).forEach(k => { o[k.trim()] = (r[k] || '').trim(); });
    return o;
  });

  /* Map to internal records */
  const records = norm.map(r => {
    const vtypes   = parseVtypeStr(r['violation_type'] || r['violation_types'] || '');
    const hour     = parseHour(r['created_datetime'] || r['created_dt'] || '');
    const month    = parseMonth(r['created_datetime'] || r['created_dt'] || '');
    const dow      = parseDow(r['created_datetime'] || r['created_dt'] || '');
    const jname    = (r['junction_name'] || '').trim();
    const atJunc   = jname !== '' && jname !== 'No Junction' && jname !== 'nan';
    const numV     = vtypes.length || 1;
    const impact   = numV * 1.5 + (atJunc ? 2 : 0);
    const lat      = parseFloat(r['latitude']  || r['lat']  || 0);
    const lon      = parseFloat(r['longitude'] || r['lon']  || 0);
    return {
      vtype_list:     vtypes,
      vtype_primary:  vtypes[0] || 'UNKNOWN',
      hour, month, dow,
      at_junction:    atJunc,
      junction_name:  jname || 'No Junction',
      vehicle_type:   (r['vehicle_type'] || 'UNKNOWN').toUpperCase(),
      police_station: r['police_station'] || '',
      lat, lon,
      num_violations: numV,
      impact_score:   impact,
    };
  }).filter(r => r.hour !== null);

  const total = records.length;
  if (total === 0) throw new Error('No valid rows found — check your CSV columns.');

  /* KPIs */
  const atJuncC  = records.filter(r => r.at_junction).length;
  const nightC   = records.filter(r => r.hour >= 20 || r.hour <= 5).length;
  const multiC   = records.filter(r => r.num_violations > 1).length;
  const scootC   = records.filter(r => ['SCOOTER', 'MOTOR CYCLE', 'MOTORCYCLE'].includes(r.vehicle_type)).length;

  const juncCts  = {};
  records.filter(r => r.at_junction).forEach(r => {
    juncCts[r.junction_name] = (juncCts[r.junction_name] || 0) + 1;
  });
  const topJunc  = Object.entries(juncCts).sort((a, b) => b[1] - a[1])[0] || ['—', 0];

  const kpis = {
    total,
    junction_pct:        r1(atJuncC / total * 100),
    night_pct:           r1(nightC  / total * 100),
    multi_pct:           r1(multiC  / total * 100),
    scooter_mc_pct:      r1(scootC  / total * 100),
    top_junction:        topJunc[0],
    top_junction_count:  topJunc[1],
  };

  /* Hourly */
  const hourly = {};
  for (let h = 0; h < 24; h++) hourly[h] = 0;
  records.forEach(r => { hourly[r.hour]++; });

  /* Violation types */
  const vtCt = {};
  records.forEach(r => r.vtype_list.forEach(v => { vtCt[v] = (vtCt[v] || 0) + 1; }));
  const vtypes = Object.entries(vtCt).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([type, count]) => ({ type, count }));

  /* Vehicles */
  const vehCt = {};
  records.forEach(r => { vehCt[r.vehicle_type] = (vehCt[r.vehicle_type] || 0) + 1; });
  const vehicles = Object.entries(vehCt).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([type, count]) => ({ type, count }));

  /* Monthly */
  const mMap = { 11:'Nov', 12:'Dec', 1:'Jan', 2:'Feb', 3:'Mar', 4:'Apr' };
  const mOrd = ['Nov','Dec','Jan','Feb','Mar','Apr'];
  const mCt  = {};
  records.forEach(r => { if (r.month) mCt[r.month] = (mCt[r.month] || 0) + 1; });
  const monthly = Object.entries(mCt)
    .filter(([m]) => mMap[+m])
    .map(([m, count]) => ({ month: mMap[+m], count }))
    .sort((a, b) => mOrd.indexOf(a.month) - mOrd.indexOf(b.month));

  /* Stations */
  const stnCt = {};
  records.forEach(r => { if (r.police_station) stnCt[r.police_station] = (stnCt[r.police_station] || 0) + 1; });
  const stations = Object.entries(stnCt).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([station, count]) => ({ station, count }));

  /* Day of week */
  const dowOrd = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dowCt  = {};
  records.forEach(r => { if (r.dow) dowCt[r.dow] = (dowCt[r.dow] || 0) + 1; });
  const dow = dowOrd.map(d => ({ day: d.slice(0, 3), count: dowCt[d] || 0 }));

  /* Junctions */
  const jMap = {};
  records.filter(r => r.at_junction && r.lat && r.lon).forEach(r => {
    const k = r.junction_name;
    if (!jMap[k]) jMap[k] = { count:0, impact:0, lats:[], lons:[], hours:[], vehs:[] };
    jMap[k].count++;
    jMap[k].impact += r.impact_score;
    jMap[k].lats.push(r.lat);
    jMap[k].lons.push(r.lon);
    jMap[k].hours.push(r.hour);
    jMap[k].vehs.push(r.vehicle_type);
  });
  const junctions = Object.entries(jMap)
    .sort((a, b) => b[1].impact - a[1].impact).slice(0, 15)
    .map(([name, j]) => ({
      name:        name.replace(/^BTP\d+\s*-\s*/, ''),
      full_name:   name,
      count:       j.count,
      impact:      r1(j.impact),
      lat:         r6(avg(j.lats)),
      lon:         r6(avg(j.lons)),
      peak_hour:   parseInt(mode(j.hours)),
      top_vehicle: mode(j.vehs),
    }));

  /* Map points (sampled, max 2500) */
  const validPts = records.filter(r => r.lat && r.lon && Math.abs(r.lat) > 0.01);
  const map_points = sample(validPts, 2500, rng).map(r => ({
    lat: r6(r.lat), lon: r6(r.lon),
    hour: r.hour,   vtype: r.vtype_primary,
    veh:  r.vehicle_type, impact: r1(r.impact_score),
    junction: r.junction_name, station: r.police_station,
  }));

  /* K-Means clusters (K=8) — sample up to 5000 pts for performance */
  const clusterSrc = sample(validPts.filter(r => r.hour != null), 5000, rng);
  const lats    = clusterSrc.map(r => r.lat);
  const lons    = clusterSrc.map(r => r.lon);
  const hours   = clusterSrc.map(r => r.hour);
  const impacts = clusterSrc.map(r => r.impact_score);
  const nL = normalise(lats), nO = normalise(lons);
  const nH = normalise(hours).map(v => v * 0.5);
  const nI = normalise(impacts).map(v => v * 0.5);
  const pts4d    = clusterSrc.map((_, i) => [nL[i], nO[i], nH[i], nI[i]]);
  const assignments = kMeans(pts4d, 8, 20, rng);

  const cMap = {};
  clusterSrc.forEach((r, i) => {
    const c = assignments[i];
    if (!cMap[c]) cMap[c] = { count:0, impact:0, lats:[], lons:[], hours:[], vtypes:[], vehs:[], juncs:[] };
    cMap[c].count++;
    cMap[c].impact   += r.impact_score;
    cMap[c].lats.push(r.lat);
    cMap[c].lons.push(r.lon);
    cMap[c].hours.push(r.hour);
    cMap[c].vtypes.push(r.vtype_primary);
    cMap[c].vehs.push(r.vehicle_type);
    cMap[c].juncs.push(r.at_junction ? 1 : 0);
  });

  const totalImpact = Object.values(cMap).reduce((s, c) => s + c.impact, 0);
  const clusters = Object.values(cMap)
    .sort((a, b) => b.impact - a.impact)
    .map((c, i) => {
      const pct  = c.impact / totalImpact;
      const risk = pct > 0.25 ? 'Critical' : pct > 0.15 ? 'High' : pct > 0.08 ? 'Medium' : 'Low';
      return {
        cluster_id:   i + 1, rank: i + 1,
        count:        c.count,
        lat:          r6(avg(c.lats)),
        lon:          r6(avg(c.lons)),
        avg_impact:   r2(c.impact / c.count),
        total_impact: r1(c.impact),
        peak_hour:    parseInt(mode(c.hours)),
        junction_pct: r1(avg(c.juncs) * 100),
        top_vtype:    mode(c.vtypes),
        top_vehicle:  mode(c.vehs),
        risk_level:   risk,
      };
    });

  /* Live feed pool (500 sampled) */
  const live_pool = sample(validPts, 500, rng).map(r => ({
    lat: r6(r.lat), lon: r6(r.lon),
    hour: r.hour,   vtype: r.vtype_primary,
    veh:  r.vehicle_type, impact: r1(r.impact_score),
    junction: r.junction_name, station: r.police_station,
    at_junction: r.at_junction,
  }));

  return { kpis, hourly, vtypes, vehicles, monthly, stations, junctions, map_points, dow, clusters, live_pool };
}
