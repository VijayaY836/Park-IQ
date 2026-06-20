/* js/app.js — main entry point */

document.addEventListener('DOMContentLoaded', async () => {
  /* ---- Load data ---- */
  const ok = await loadData();
  if (!ok) {
    document.querySelector('.section.active .section-header p').textContent =
      'Error loading data. Please run via a local server (see README).';
    return;
  }

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

    /* lazy init map */
    if (id === 'map' && !mapInited) {
      setTimeout(() => {
        initMap();
        wireMapControls();
        mapInited = true;
      }, 50);
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      switchSection(section);
      /* close sidebar on mobile */
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  /* Mobile menu */
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  /* ---- Populate KPIs ---- */
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

  /* ---- Analytics charts ---- */
  renderStationChart(DATA.stations);
  populateStationSelect(DATA.stations);

  /* ---- Junction table ---- */
  renderJunctionTable(DATA.junctions);

  /* ---- Allocation ---- */
  renderAllocation(DATA.junctions);
  renderCoverageChart(DATA.junctions);

  /* ---- AI section ---- */
  DATA.clusters = DATA.clusters || [];
  renderClusterCards();
  wireLiveFeedControls();
});