/* js/charts.js — renders all Chart.js charts */

const CHART_COLORS = {
  blue:    '#2563EB',
  blueD:   'rgba(37,99,235,0.10)',
  amber:   '#F59E0B',
  amberD:  'rgba(245,158,11,0.15)',
  red:     '#EF4444',
  green:   '#10B981',
  purple:  '#8B5CF6',
  teal:    '#14B8A6',
  pink:    '#EC4899',
};

const TICK_COLOR  = '#64748B';
const GRID_COLOR  = 'rgba(15,23,42,0.07)';

/* Registered charts cache for destroy-on-redraw */
const _charts = {};

function _make(id, config) {
  if (_charts[id]) _charts[id].destroy();
  _charts[id] = new Chart(document.getElementById(id), config);
  return _charts[id];
}

/* -------- HOURLY -------- */
function renderHourChart(hourly) {
  const labels = Array.from({ length: 24 }, (_, i) => hourLabel(i));
  const data   = Array.from({ length: 24 }, (_, i) => hourly[String(i)] || hourly[i] || 0);
  const colors = data.map((_, i) => (i >= 20 || i <= 6) ? CHART_COLORS.amber : 'rgba(37,99,235,0.55)');

  _make('hourChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Violations',
        data,
        backgroundColor: colors,
        borderRadius: 3,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.toLocaleString('en-IN')} violations`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: TICK_COLOR, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false },
        },
        y: {
          ticks: { color: TICK_COLOR, font: { size: 9 }, callback: v => fmtK(v) },
          grid: { color: GRID_COLOR },
        },
      },
    },
  });
}

/* -------- VIOLATION TYPE DOUGHNUT -------- */
function renderVtypeChart(vtypes) {
  const top = vtypes.slice(0, 5);
  const otherCount = vtypes.slice(5).reduce((s, v) => s + v.count, 0);
  const labels = [...top.map(v => v.type.replace('PARKING', 'PKG').replace('WRONG ', 'WRONG ')), 'OTHER'];
  const values = [...top.map(v => v.count), otherCount];
  const colors = [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.purple, CHART_COLORS.pink, TICK_COLOR];

  _make('vtypeChart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw.toLocaleString('en-IN')}` } },
      },
    },
  });

  /* custom legend */
  const legEl = document.getElementById('vtypeLegend');
  if (legEl) {
    legEl.innerHTML = labels.map((l, i) =>
      `<span class="legend-item">
        <span class="legend-swatch" style="background:${colors[i]}"></span>
        ${l}
       </span>`
    ).join('');
  }
}

/* -------- VEHICLE HORIZONTAL BAR -------- */
function renderVehChart(vehicles) {
  const labels = vehicles.map(v => v.type.replace('PASSENGER ', 'PASS. ').replace('MOTOR CYCLE', 'M/CYCLE'));
  const data   = vehicles.map(v => v.count);

  _make('vehChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Violations',
        data,
        backgroundColor: CHART_COLORS.blue,
        borderRadius: 3,
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, font: { size: 9 }, callback: v => fmtK(v) }, grid: { color: GRID_COLOR } },
        y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { display: false } },
      },
    },
  });
}

/* -------- MONTHLY LINE -------- */
function renderMonthChart(monthly) {
  const labels = monthly.map(m => m.month);
  const data   = monthly.map(m => m.count);

  _make('monthChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Violations',
        data,
        borderColor: CHART_COLORS.blue,
        backgroundColor: CHART_COLORS.blueD,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: CHART_COLORS.blue,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: TICK_COLOR, font: { size: 9 }, callback: v => fmtK(v) }, grid: { color: GRID_COLOR } },
      },
    },
  });
}

/* -------- DAY OF WEEK -------- */
function renderDowChart(dow) {
  const labels = dow.map(d => d.day);
  const data   = dow.map(d => d.count);

  _make('dowChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Violations',
        data,
        backgroundColor: CHART_COLORS.purple,
        borderRadius: 3,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: TICK_COLOR, font: { size: 9 }, callback: v => fmtK(v) }, grid: { color: GRID_COLOR } },
      },
    },
  });
}

/* -------- STATION BAR -------- */
function renderStationChart(stations) {
  const labels = stations.map(s => s.station.replace('HAL Old Airport', 'HAL Airport').replace('Jeevanbheemanagar', 'J.B.Nagar'));
  const data   = stations.map(s => s.count);

  _make('stnChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Violations',
        data,
        backgroundColor: CHART_COLORS.teal,
        borderRadius: 3,
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, font: { size: 9 }, callback: v => fmtK(v) }, grid: { color: GRID_COLOR } },
        y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { display: false } },
      },
    },
  });
}

/* -------- STATION HOURLY (re-computed from map points) -------- */
function renderStationHourChart(stationName) {
  /* compute from mapPoints */
  const pts = DATA.mapPoints.filter(p => p.station === stationName);
  const counts = Array(24).fill(0);
  pts.forEach(p => { if (p.hour != null) counts[p.hour]++; });
  const labels = Array.from({ length: 24 }, (_, i) => hourLabel(i));
  const colors = counts.map((_, i) => (i >= 20 || i <= 6) ? CHART_COLORS.amber : 'rgba(37,99,235,0.55)');

  _make('stationHourChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Violations',
        data: counts,
        backgroundColor: colors,
        borderRadius: 3,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        y: { ticks: { color: TICK_COLOR, font: { size: 9 }, callback: v => String(v) }, grid: { color: GRID_COLOR } },
      },
    },
  });
}

/* -------- COVERAGE CURVE -------- */
function renderCoverageChart(junctions) {
  const maxImpact = junctions.reduce((s, j) => s + j.impact, 0);
  const labels = [];
  const values = [];
  let cumulative = 0;
  for (let i = 0; i < Math.min(15, junctions.length); i++) {
    cumulative += junctions[i].impact;
    labels.push(i + 1);
    values.push(Math.round(cumulative / maxImpact * 100));
  }

  _make('coverageChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '% coverage',
        data: values,
        borderColor: CHART_COLORS.green,
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: CHART_COLORS.green,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.raw}% impact covered` } },
      },
      scales: {
        x: {
          title: { display: true, text: 'Patrol units deployed', color: TICK_COLOR, font: { size: 11 } },
          ticks: { color: TICK_COLOR, font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          min: 0, max: 100,
          ticks: { color: TICK_COLOR, font: { size: 9 }, callback: v => v + '%' },
          grid: { color: GRID_COLOR },
        },
      },
    },
  });
}