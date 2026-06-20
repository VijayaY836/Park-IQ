/* js/allocation.js — greedy patrol allocation model + junction table */

/* ---- Greedy allocation ---- */
function computeAllocation(junctions, n, shiftFilter) {
  let eligible = [...junctions];

  if (shiftFilter === 'night') {
    /* peak hour in 20-23 or 0-6 */
    eligible = eligible.filter(j => j.peak_hour >= 20 || j.peak_hour <= 6);
  } else if (shiftFilter === 'day') {
    eligible = eligible.filter(j => j.peak_hour > 6 && j.peak_hour < 20);
  }

  eligible.sort((a, b) => b.impact - a.impact);
  const assigned = eligible.slice(0, n);
  const totalImpact = junctions.reduce((s, j) => s + j.impact, 0);
  const coveredImpact = assigned.reduce((s, j) => s + j.impact, 0);
  const coveragePct = Math.round((coveredImpact / totalImpact) * 100);

  return { assigned, coveragePct };
}

function shiftHours(peak_hour) {
  /* suggest a 4-hour patrol window around peak */
  const start = ((peak_hour - 1) + 24) % 24;
  const end   = (peak_hour + 3) % 24;
  return `${hourLabel(start)} – ${hourLabel(end)}`;
}

function renderAllocation(junctions) {
  const slider   = document.getElementById('unitSlider');
  const shiftSel = document.getElementById('shiftSelect');
  const unitVal  = document.getElementById('unitVal');
  const summary  = document.getElementById('allocSummary');
  const list     = document.getElementById('allocList');

  function update() {
    const n     = parseInt(slider.value, 10);
    const shift = shiftSel.value;
    unitVal.textContent = n;

    const { assigned, coveragePct } = computeAllocation(junctions, n, shift);

    summary.innerHTML = `
      Deploying <strong>${n} patrol unit${n > 1 ? 's' : ''}</strong> 
      covers <span class="coverage-pct">${coveragePct}%</span> 
      of total violation impact. 
      ${n >= 6 ? 'Diminishing returns beyond 8 units — consider fixed CCTV in remaining zones.' : 'Adding more units significantly increases coverage.'}
    `;

    list.innerHTML = assigned.map((j, i) => `
      <div class="alloc-item">
        <div class="alloc-rank">${i + 1}</div>
        <div>
          <div class="alloc-name">${j.name}</div>
          <div class="alloc-station">● ${j.top_vehicle} dominated · ${j.count.toLocaleString('en-IN')} total violations</div>
        </div>
        <div class="alloc-hours">${shiftHours(j.peak_hour)}</div>
        <div class="alloc-impact">
          <span>${Math.round(j.impact / 1000)}k</span>impact score
        </div>
      </div>
    `).join('');
  }

  slider.addEventListener('input', update);
  shiftSel.addEventListener('change', update);
  update(); /* initial render */
}

/* ---- Junction table ---- */
function renderJunctionTable(junctions) {
  let sorted = [...junctions];
  let currentSort = 'impact';
  const tbody  = document.getElementById('junctionTbody');
  const search = document.getElementById('junctionSearch');
  const maxImpact = junctions[0].impact;

  function draw() {
    const q = search.value.trim().toLowerCase();
    const rows = sorted.filter(j => !q || j.name.toLowerCase().includes(q));

    tbody.innerHTML = rows.map((j, i) => {
      const { label, cls } = priorityLabel(j.impact, maxImpact);
      const barW = Math.round((j.impact / maxImpact) * 120);
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${j.name}</td>
          <td>${j.count.toLocaleString('en-IN')}</td>
          <td>
            <div class="impact-bar-wrap">
              <div class="impact-bar" style="width:${barW}px"></div>
              <span class="impact-label">${Math.round(j.impact / 1000)}k</span>
            </div>
          </td>
          <td>${hourLabel(j.peak_hour)}</td>
          <td>${j.top_vehicle}</td>
          <td><span class="priority-badge ${cls}">${label}</span></td>
        </tr>
      `;
    }).join('');
  }

  /* Sort buttons */
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      if (currentSort === 'impact') sorted.sort((a, b) => b.impact - a.impact);
      if (currentSort === 'count')  sorted.sort((a, b) => b.count - a.count);
      if (currentSort === 'peak')   sorted.sort((a, b) => a.peak_hour - b.peak_hour);
      draw();
    });
  });

  search.addEventListener('input', draw);
  draw();
}

/* ---- Station select for analytics ---- */
function populateStationSelect(stations) {
  const sel = document.getElementById('stationSelect');
  if (!sel) return;
  sel.innerHTML = stations.map(s =>
    `<option value="${s.station}">${s.station}</option>`
  ).join('');
  sel.addEventListener('change', e => renderStationHourChart(e.target.value));
  /* render initial */
  renderStationHourChart(stations[0].station);
}