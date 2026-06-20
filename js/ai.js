/* js/ai.js — K-Means cluster display + simulated live feed */

/* ============================================================
   CLUSTER MAP
   ============================================================ */
let _clusterLayer   = null;
let _clusterMapRef  = null;   /* holds the aiMap instance */

const CLUSTER_COLORS = {
  'Critical': '#F05252',
  'High':     '#F5A623',
  'Medium':   '#1E8AFF',
  'Low':      '#10B981',
};

const CLUSTER_RADIUS = {
  'Critical': 2200,
  'High':     1800,
  'Medium':   1400,
  'Low':      1000,
};

/* Pass the target map explicitly — never relies on the global _map */
function renderClusterMap(targetMap) {
  if (!targetMap) return;
  if (_clusterLayer) {
    try { targetMap.removeLayer(_clusterLayer); } catch(e) {}
    _clusterLayer = null;
  }

  const layers = DATA.clusters.map(c => {
    const col    = CLUSTER_COLORS[c.risk_level];
    const radius = CLUSTER_RADIUS[c.risk_level];

    const circle = L.circle([c.lat, c.lon], {
      radius,
      color: col,
      fillColor: col,
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '5 5',
    });

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${col};
        color:#fff;
        font-size:11px;
        font-weight:700;
        padding:4px 10px;
        border-radius:20px;
        white-space:nowrap;
        box-shadow:0 2px 10px ${col}88;
        border:1.5px solid rgba(255,255,255,0.4);
        pointer-events:none;
      ">${c.risk_level} · ${Math.round(c.total_impact/1000)}k</div>`,
      iconAnchor: [45, 12],
    });
    const marker = L.marker([c.lat, c.lon], { icon });

    marker.bindPopup(`
      <strong>Cluster #${c.rank} — ${c.risk_level} Risk</strong><br>
      Violations: <b>${c.count.toLocaleString('en-IN')}</b><br>
      Total impact: <b>${Math.round(c.total_impact / 1000)}k</b><br>
      Peak hour: <b>${hourLabel(c.peak_hour)}</b><br>
      At junction: <b>${c.junction_pct}%</b><br>
      Top violation: <b>${c.top_vtype}</b><br>
      Top vehicle: <b>${c.top_vehicle}</b>
    `);

    return L.layerGroup([circle, marker]);
  });

  _clusterLayer = L.layerGroup(layers).addTo(targetMap);
}

function clearClusterLayer(targetMap) {
  if (_clusterLayer) {
    try { if (targetMap) targetMap.removeLayer(_clusterLayer); } catch(e) {}
    _clusterLayer = null;
  }
}

/* ---- Cluster cards in AI section ---- */
function renderClusterCards() {
  const container = document.getElementById('clusterCards');
  if (!container || !DATA.clusters || !DATA.clusters.length) return;
  const maxImpact = DATA.clusters[0].total_impact;

  container.innerHTML = DATA.clusters.map((c) => {
    const col  = CLUSTER_COLORS[c.risk_level] || '#1E8AFF';
    const barW = Math.round((c.total_impact / maxImpact) * 100);
    return `
      <div class="cluster-card" style="--accent:${col}">
        <div class="cluster-header">
          <span class="cluster-rank">#${c.rank}</span>
          <span class="risk-badge" style="background:${col}22;color:${col}">${c.risk_level}</span>
          <span class="cluster-impact">${Math.round(c.total_impact/1000)}k impact</span>
        </div>
        <div class="cluster-bar-wrap">
          <div class="cluster-bar" style="width:${barW}%;background:${col}"></div>
        </div>
        <div class="cluster-stats">
          <div class="cstat"><span class="cstat-label">Violations</span><span class="cstat-val">${c.count.toLocaleString('en-IN')}</span></div>
          <div class="cstat"><span class="cstat-label">Peak hour</span><span class="cstat-val">${hourLabel(c.peak_hour)}</span></div>
          <div class="cstat"><span class="cstat-label">At junction</span><span class="cstat-val">${c.junction_pct}%</span></div>
          <div class="cstat"><span class="cstat-label">Top vehicle</span><span class="cstat-val">${c.top_vehicle}</span></div>
        </div>
        <div class="cluster-vtype">${c.top_vtype.replace('PARKING IN A MAIN ROAD','MAIN ROAD PKG')}</div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   CLUSTER MAP TOGGLE  (called from inline onclick in HTML)
   ============================================================ */
let _clustersVisible = false;

function toggleClusters() {
  const btn = document.getElementById('btnShowClusters');
  const note = document.getElementById('clusterMapNote');

  /* Init aiMap lazily the first time */
  if (!_clusterMapRef) {
    _clusterMapRef = L.map('aiMap', { center: [12.978, 77.590], zoom: 12 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(_clusterMapRef);
  }

  if (_clustersVisible) {
    clearClusterLayer(_clusterMapRef);
    _clustersVisible = false;
    btn.textContent = 'Show on map';
    note.textContent = 'Click "Show on map" above to overlay clusters';
  } else {
    renderClusterMap(_clusterMapRef);
    _clustersVisible = true;
    btn.textContent = 'Hide clusters';
    note.textContent = `${DATA.clusters.length} AI-discovered zones now showing`;
    /* Fit map to cluster bounds */
    try {
      const lats = DATA.clusters.map(c => c.lat);
      const lons = DATA.clusters.map(c => c.lon);
      _clusterMapRef.fitBounds([
        [Math.min(...lats) - 0.02, Math.min(...lons) - 0.02],
        [Math.max(...lats) + 0.02, Math.max(...lons) + 0.02],
      ]);
    } catch(e) {}
  }
}

/* ============================================================
   LIVE FEED SIMULATOR
   ============================================================ */
let _liveInterval   = null;
let _liveRunning    = false;
let _liveCount      = 0;
let _liveTotal      = 0;
let _liveFeedIndex  = 0;
let _liveLogEntries = [];

const INTERVAL_MS = 1800;
const MAX_LOG     = 12;

function startLiveFeed() {
  if (_liveRunning) return;
  if (!DATA.live_pool || !DATA.live_pool.length) {
    console.error('live_pool is empty or missing');
    return;
  }
  _liveRunning   = true;
  _liveFeedIndex = 0;

  const statusEl = document.getElementById('liveFeedStatus');
  const startBtn = document.getElementById('btnStartFeed');
  const stopBtn  = document.getElementById('btnStopFeed');

  if (statusEl) { statusEl.textContent = '● LIVE'; statusEl.style.color = '#10B981'; }
  if (startBtn) startBtn.disabled = true;
  if (stopBtn)  stopBtn.disabled  = false;

  _liveInterval = setInterval(tickLiveFeed, INTERVAL_MS);
  tickLiveFeed();
}

function stopLiveFeed() {
  if (!_liveRunning) return;
  _liveRunning = false;
  clearInterval(_liveInterval);
  _liveInterval = null;

  const statusEl = document.getElementById('liveFeedStatus');
  const startBtn = document.getElementById('btnStartFeed');
  const stopBtn  = document.getElementById('btnStopFeed');

  if (statusEl) { statusEl.textContent = '○ PAUSED'; statusEl.style.color = '#F5A623'; }
  if (startBtn) startBtn.disabled = false;
  if (stopBtn)  stopBtn.disabled  = true;
}

function tickLiveFeed() {
  const pool = DATA.live_pool;
  if (!pool || !pool.length) return;

  const rec = pool[_liveFeedIndex % pool.length];
  _liveFeedIndex++;
  _liveCount++;
  _liveTotal += rec.impact || 0;

  const countEl  = document.getElementById('liveCount');
  const impactEl = document.getElementById('liveImpact');
  if (countEl)  countEl.textContent  = _liveCount.toLocaleString('en-IN');
  if (impactEl) impactEl.textContent = Math.round(_liveTotal).toLocaleString('en-IN');

  const isJunction = rec.at_junction;
  const highImpact = (rec.impact || 0) >= 3.5;
  const urgency    = (isJunction && highImpact) ? 'critical' : isJunction ? 'warning' : 'normal';

  const now  = new Date();
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let junctionName = 'Non-junction';
  if (isJunction && rec.junction) {
    junctionName = rec.junction.replace(/^BTP\d+\s*-\s*/, '');
  }

  const entry = {
    time,
    vtype:    rec.vtype   || 'WRONG PARKING',
    veh:      rec.veh     || 'UNKNOWN',
    station:  rec.station || '—',
    junction: junctionName,
    impact:   rec.impact  || 0,
    urgency,
  };

  _liveLogEntries.unshift(entry);
  if (_liveLogEntries.length > MAX_LOG) _liveLogEntries.pop();

  renderLiveLog();
  renderLiveSparkline();

  /* Flash dot on aiMap if it exists */
  if (_clusterMapRef && rec.lat && rec.lon) {
    flashMapDot(rec.lat, rec.lon, urgency);
  }
}

function renderLiveLog() {
  const tbody = document.getElementById('liveFeedTbody');
  if (!tbody) return;

  tbody.innerHTML = _liveLogEntries.map((e, i) => {
    const cls = e.urgency === 'critical' ? 'row-critical' : e.urgency === 'warning' ? 'row-warning' : '';
    const dot = e.urgency === 'critical' ? '🔴' : e.urgency === 'warning' ? '🟡' : '🔵';
    const jDisplay = e.junction.length > 28 ? e.junction.slice(0, 26) + '…' : e.junction;
    return `
      <tr class="${cls} ${i === 0 ? 'row-new' : ''}">
        <td class="feed-time">${e.time}</td>
        <td>${dot} ${e.vtype.replace('PARKING IN A MAIN ROAD', 'MAIN ROAD PKG')}</td>
        <td>${e.veh}</td>
        <td>${jDisplay}</td>
        <td>${e.station}</td>
        <td class="${e.urgency === 'critical' ? 'impact-critical' : ''}">${e.impact}</td>
      </tr>
    `;
  }).join('');
}

/* Sparkline */
let _sparkValues = [];
function renderLiveSparkline() {
  _sparkValues.push(_liveLogEntries[0]?.impact || 0);
  if (_sparkValues.length > 20) _sparkValues.shift();

  const canvas = document.getElementById('liveSparkline');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (_sparkValues.length < 2) return;

  const max  = Math.max(..._sparkValues, 1);
  const step = W / (_sparkValues.length - 1);

  ctx.beginPath();
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth   = 2;
  _sparkValues.forEach((v, i) => {
    const x = i * step;
    const y = H - (v / max) * (H - 4) - 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = 'rgba(16,185,129,0.12)';
  ctx.fill();
}

/* Flash dot on map */
let _flashMarker = null;
function flashMapDot(lat, lon, urgency) {
  const col = urgency === 'critical' ? '#F05252' : urgency === 'warning' ? '#F5A623' : '#1E8AFF';
  if (_flashMarker) {
    try { _clusterMapRef.removeLayer(_flashMarker); } catch(e) {}
  }
  _flashMarker = L.circleMarker([lat, lon], {
    radius: 9, color: col, fillColor: col, fillOpacity: 0.9, weight: 0,
  }).addTo(_clusterMapRef);
  setTimeout(() => {
    try { if (_clusterMapRef) _clusterMapRef.removeLayer(_flashMarker); } catch(e) {}
  }, 1400);
}

/* ---- Wire live feed buttons — called after DOM is ready ---- */
function wireLiveFeedControls() {
  /* Use event delegation on document so it works even if section
     wasn't visible when app.js ran */
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'btnStartFeed') startLiveFeed();
    if (e.target && e.target.id === 'btnStopFeed')  stopLiveFeed();
  });
}