/* js/app.js — entry point: overlay → data → dashboard */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ============================================================
   OVERLAY
   ============================================================ */
function showOverlayStatus(type, msg) {
  const el = document.getElementById('dsStatus');
  el.className = 'ds-status ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideOverlayStatus() {
  document.getElementById('dsStatus').style.display = 'none';
}

function dismissOverlay(callback) {
  const overlay = document.getElementById('dataOverlay');
  overlay.classList.add('ds-hidden');
  setTimeout(() => {
    overlay.style.display = 'none';
    if (callback) callback();
  }, 380);
}

function setupOverlay() {
  /* ---- Use default data ---- */
  document.getElementById('btnUseDefault').addEventListener('click', async () => {
    document.getElementById('btnUseDefault').disabled = true;
    showOverlayStatus('loading', 'Loading BTP dataset…');
    const ok = await loadData();
    if (!ok) {
      showOverlayStatus('error', 'Could not load default dataset. Make sure you are running via a local server (see README).');
      document.getElementById('btnUseDefault').disabled = false;
      return;
    }
    dismissOverlay(bootDashboard);
  });

  /* ---- CSV file selected ---- */
  document.getElementById('csvFileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('dsFileName').textContent = '📄 ' + file.name;
    document.getElementById('dsUploadReady').style.display = 'flex';
    hideOverlayStatus();
  });

  /* ---- Process uploaded CSV ---- */
  document.getElementById('btnProcessCSV').addEventListener('click', async () => {
    const file = document.getElementById('csvFileInput').files[0];
    if (!file) return;

    document.getElementById('btnProcessCSV').disabled = true;
    showOverlayStatus('loading', 'Parsing CSV…');
    await sleep(40);

    let rows;
    try {
      rows = await parseCSVFile(file);
    } catch (err) {
      showOverlayStatus('error', 'CSV parse error: ' + err.message);
      document.getElementById('btnProcessCSV').disabled = false;
      return;
    }

    showOverlayStatus('loading', `Processing ${rows.length.toLocaleString()} records and running K‑Means clustering…`);
    await sleep(40);

    let json;
    try {
      json = processCSV(rows);
    } catch (err) {
      showOverlayStatus('error', err.message);
      document.getElementById('btnProcessCSV').disabled = false;
      return;
    }

    populateData(json);
    dismissOverlay(bootDashboard);
  });
}

/* ============================================================
   DASHBOARD BOOT (runs after data is ready)
   ============================================================ */
function bootDashboard() {
  /* ---- Navigation ---- */
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');
  const topbarTitle = document.getElementById('topbarTitle');

  const sectionTitles = {
    overview:   'Overview',
    map:        'Hotspot Map',
    analytics:  'Analytics',
    junctions:  'Junctions',
    allocation: 'Patrol Allocation',
    ai:         'AI Intelligence',
  };

  let mapInited = false;

  function switchSection(id) {
    sections.forEach(s => s.classList.remove('active'));
    navLinks.forEach(l => l.classList.remove('active'));

    const target = document.getElementById('section-' + id);
    if (target) target.classList.add('active');

    const link = document.querySelector(`.nav-link[data-section="${id}"]`);
    if (link) link.classList.add('active');

    topbarTitle.textContent = sectionTitles[id] || id;

    if (id === 'map' && !mapInited) {
      setTimeout(() => { initMap(); wireMapControls(); mapInited = true; }, 50);
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchSection(link.dataset.section);
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  /* ---- KPIs ---- */
  const { kpis } = DATA;
  document.getElementById('kpi-total').textContent    = fmt(kpis.total);
  document.getElementById('kpi-junction').textContent = kpis.junction_pct + '%';
  document.getElementById('kpi-night').textContent    = kpis.night_pct + '%';
  document.getElementById('kpi-multi').textContent    = kpis.multi_pct + '%';

  /* ---- Overview charts ---- */
  renderHourChart(DATA.hourly);
  renderVtypeChart(DATA.vtypes);
  renderVehChart(DATA.vehicles);
  renderMonthChart(DATA.monthly);
  renderDowChart(DATA.dow);

  /* ---- Analytics ---- */
  renderStationChart(DATA.stations);
  populateStationSelect(DATA.stations);

  /* ---- Junction table ---- */
  renderJunctionTable(DATA.junctions);

  /* ---- Allocation ---- */
  renderAllocation(DATA.junctions);
  renderCoverageChart(DATA.junctions);

  /* ---- AI section ---- */
  renderClusterCards();
  wireLiveFeedControls();
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', setupOverlay);
