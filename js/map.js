/* js/map.js — Leaflet heatmap + dot map */

let _map = null;
let _heatLayer = null;
let _dotLayer  = null;
let _mapMode   = 'heat'; /* 'heat' | 'dots' */
let _hourFilter = 'all';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a>';

function initMap() {
  if (_map) return;

  _map = L.map('map', {
    center: [12.978, 77.590],
    zoom: 12,
    zoomControl: true,
  });

  L.tileLayer(TILE_URL, {
    attribution: TILE_ATTR,
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(_map);

  /* Junction markers always on */
  addJunctionMarkers();

  renderMapMode();
}

/* ---- Filter helpers ---- */
function applyHourFilter(pts) {
  if (_hourFilter === 'all')   return pts;
  if (_hourFilter === 'night') return pts.filter(p => p.hour != null && (p.hour >= 20 || p.hour <= 5));
  if (_hourFilter === 'day')   return pts.filter(p => p.hour != null && p.hour > 5 && p.hour < 20);
  if (_hourFilter === 'peak')  return pts.filter(p => p.hour != null && ((p.hour >= 7 && p.hour <= 9) || (p.hour >= 18 && p.hour <= 21)));
  return pts;
}

/* ---- Heatmap ---- */
function showHeatmap() {
  clearDots();
  const pts = applyHourFilter(DATA.mapPoints);
  const heat = pts.map(p => [p.lat, p.lon, (p.impact || 1) / 5]);

  _heatLayer = L.heatLayer(heat, {
    radius: 18,
    blur: 22,
    maxZoom: 15,
    gradient: { 0.2: '#1E8AFF', 0.5: '#F5A623', 0.8: '#F05252', 1.0: '#FF1744' },
  }).addTo(_map);
}

function clearHeat() {
  if (_heatLayer) { _map.removeLayer(_heatLayer); _heatLayer = null; }
}

/* ---- Dot map ---- */
function showDots() {
  clearHeat();
  const pts = applyHourFilter(DATA.mapPoints).slice(0, 3000);
  const markers = pts.map(p => {
    const col = p.junction === 'No Junction'
      ? '#1E8AFF'
      : (p.impact > 3.5 ? '#F05252' : '#F5A623');
    const circle = L.circleMarker([p.lat, p.lon], {
      radius: 4,
      color: col,
      fillColor: col,
      fillOpacity: 0.7,
      weight: 0,
    });
    circle.bindPopup(
      `<strong>${p.junction !== 'No Junction' ? p.junction : 'No junction'}</strong><br>
       Hour: ${p.hour != null ? hourLabel(p.hour) : '—'}<br>
       Vehicle: ${p.veh || '—'}<br>
       Station: ${p.station || '—'}`
    );
    return circle;
  });
  _dotLayer = L.layerGroup(markers).addTo(_map);
}

function clearDots() {
  if (_dotLayer) { _map.removeLayer(_dotLayer); _dotLayer = null; }
}

/* ---- Junction markers ---- */
function addJunctionMarkers() {
  const maxImpact = DATA.junctions[0].impact;

  DATA.junctions.forEach((j, idx) => {
    const size = idx < 3 ? 14 : idx < 7 ? 10 : 7;
    const col  = idx < 3 ? '#F05252' : idx < 7 ? '#F5A623' : '#1E8AFF';

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${col};
        border:2px solid #fff;
        box-shadow:0 1px 4px rgba(15,23,42,0.45);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const marker = L.marker([j.lat, j.lon], { icon });
    marker.bindPopup(`
      <strong>${j.name}</strong><br>
      Violations: <b>${j.count.toLocaleString('en-IN')}</b><br>
      Impact score: <b>${Math.round(j.impact / 1000)}k</b><br>
      Peak hour: <b>${hourLabel(j.peak_hour)}</b><br>
      Top vehicle: <b>${j.top_vehicle}</b>
    `);
    marker.addTo(_map);
  });
}

/* ---- Mode switch ---- */
function renderMapMode() {
  if (_mapMode === 'heat') showHeatmap();
  else showDots();
}

function setMapMode(mode) {
  _mapMode = mode;
  clearHeat();
  clearDots();
  renderMapMode();
}

function setHourFilter(filter) {
  _hourFilter = filter;
  clearHeat();
  clearDots();
  renderMapMode();
}

/* ---- Controls wiring (called from app.js after DOM ready) ---- */
function wireMapControls() {
  document.getElementById('btnHeat').addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btnHeat').classList.add('active');
    setMapMode('heat');
  });

  document.getElementById('btnDots').addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btnDots').classList.add('active');
    setMapMode('dots');
  });

  document.getElementById('hourFilter').addEventListener('change', e => {
    setHourFilter(e.target.value);
  });
}