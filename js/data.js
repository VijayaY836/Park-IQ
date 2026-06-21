/* js/data.js — loads violations.json and exposes DATA global */

const DATA = {
  raw: null,
  kpis: null,
  hourly: null,
  vtypes: null,
  vehicles: null,
  monthly: null,
  stations: null,
  junctions: null,
  mapPoints: null,
  dow: null,
  clusters: null,
  live_pool: null,
};

function populateData(json) {
  DATA.kpis      = json.kpis;
  DATA.hourly    = json.hourly;
  DATA.vtypes    = json.vtypes;
  DATA.vehicles  = json.vehicles;
  DATA.monthly   = json.monthly;
  DATA.stations  = json.stations;
  DATA.junctions = json.junctions;
  DATA.mapPoints = json.map_points;
  DATA.dow       = json.dow;
  DATA.clusters  = json.clusters  || [];
  DATA.live_pool = json.live_pool || [];
}

async function loadData() {
  try {
    const res = await fetch('data/violations.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    populateData(await res.json());
    return true;
  } catch (err) {
    console.error('Failed to load data:', err);
    return false;
  }
}

/* Helpers */
function fmt(n) {
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)   return n.toLocaleString('en-IN');
  return String(n);
}

function fmtK(n) {
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(Math.round(n));
}

function hourLabel(h) {
  if (h === 0)  return '12 am';
  if (h < 12)   return h + ' am';
  if (h === 12) return '12 pm';
  return (h - 12) + ' pm';
}

function priorityLabel(impact, maxImpact) {
  const pct = impact / maxImpact;
  if (pct > 0.4) return { label: 'Critical', cls: 'p1' };
  if (pct > 0.2) return { label: 'High',     cls: 'p2' };
  return              { label: 'Medium',    cls: 'p3' };
}