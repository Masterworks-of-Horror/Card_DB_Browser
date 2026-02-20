import { fetchCardData, RARITY_MAP, RARITY_ORDER } from './api.js';

let cards = [];
let sortCol = 'cardId';
let sortAsc = true;

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  document.getElementById('refresh-btn').addEventListener('click', () => load(true));
  document.getElementById('search').addEventListener('input', render);
  document.getElementById('filter-type').addEventListener('change', render);
  document.getElementById('filter-rarity').addEventListener('change', render);
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      document.querySelectorAll('th').forEach(t => t.classList.remove('sorted'));
      th.classList.add('sorted');
      render();
    });
  });
});

async function load(force = false) {
  try {
    cards = await fetchCardData(force);
    populateFilters();
    renderStats();
    renderCharts();
    render();
  } catch (e) {
    document.querySelector('main').innerHTML =
      `<p style="color:var(--blood);text-align:center;margin-top:3rem">Failed to load: ${esc(e.message)}<br><br>Make sure the Google Sheet is shared publicly.</p>`;
  }
}

function populateFilters() {
  const types = [...new Set(cards.map(c => c.cardType).filter(Boolean))].sort();
  const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))]
    .sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99));
  fill('filter-type', types);
  fill('filter-rarity', rarities);
}

function fill(id, opts) {
  const el = document.getElementById(id);
  while (el.options.length > 1) el.remove(1);
  opts.forEach(o => el.add(new Option(o, o)));
}

// ── Stats ──
function renderStats() {
  const counts = {};
  cards.forEach(c => counts[c.cardType] = (counts[c.cardType] || 0) + 1);
  const bar = document.getElementById('stats-bar');
  bar.innerHTML = [
    stat(cards.length, 'Total'),
    stat(counts['Character'] || 0, 'Characters'),
    stat(counts['Setting'] || 0, 'Settings'),
    stat(counts['Narrative'] || 0, 'Narratives'),
    stat(counts['Item'] || 0, 'Items'),
    stat(counts['Plot'] || 0, 'Plots'),
  ].join('');
}

function stat(val, label) {
  return `<div class="stat"><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div>`;
}

// ── Charts ──
let chartInstances = {};

function renderCharts() {
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};
  const defaults = Chart.defaults;
  defaults.color = '#a89b85';
  defaults.borderColor = 'rgba(201,169,89,0.1)';
  defaults.font.family = "'Crimson Text', serif";

  // Cost curve
  const costMap = {};
  cards.forEach(c => costMap[c.inspirationCost] = (costMap[c.inspirationCost] || 0) + 1);
  const costLabels = Object.keys(costMap).sort((a, b) => a - b);
  chartInstances.cost = new Chart(document.getElementById('chart-cost'), {
    type: 'bar',
    data: {
      labels: costLabels.map(l => l + ' IC'),
      datasets: [{ data: costLabels.map(l => costMap[l]), backgroundColor: '#c9a95980', borderColor: '#c9a959', borderWidth: 1, borderRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // Rarity
  const rarMap = {};
  cards.forEach(c => rarMap[c.rarity] = (rarMap[c.rarity] || 0) + 1);
  const rarLabels = Object.keys(rarMap).sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99));
  const rarColors = { Common: '#8a8a8a', Rare: '#3a6ea5', Epic: '#6b3fa0', Fabled: '#e8c94a' };
  chartInstances.rarity = new Chart(document.getElementById('chart-rarity'), {
    type: 'doughnut',
    data: {
      labels: rarLabels,
      datasets: [{ data: rarLabels.map(l => rarMap[l]), backgroundColor: rarLabels.map(l => (rarColors[l] || '#555') + 'cc'), borderColor: rarLabels.map(l => rarColors[l] || '#555'), borderWidth: 2 }]
    },
    options: { responsive: true, cutout: '50%', plugins: { legend: { position: 'bottom' } } }
  });

  // Author
  const authMap = {};
  cards.forEach(c => authMap[c.author] = (authMap[c.author] || 0) + 1);
  const authLabels = Object.keys(authMap).sort((a, b) => authMap[b] - authMap[a]);
  const authColors = { Poe: '#c23030', Lovecraft: '#2d8a4e', GogolQuiroga: '#6b3fa0', ShelleyStoker: '#3a6ea5', SonglingUeda: '#e8c94a' };
  chartInstances.author = new Chart(document.getElementById('chart-author'), {
    type: 'bar',
    data: {
      labels: authLabels,
      datasets: [{ data: authLabels.map(l => authMap[l]), backgroundColor: authLabels.map(l => (authColors[l] || '#555') + '99'), borderColor: authLabels.map(l => authColors[l] || '#555'), borderWidth: 1, borderRadius: 4 }]
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
  });

  // Might vs Will scatter
  const chars = cards.filter(c => c.cardType === 'Character' && (c.might || c.will));
  chartInstances.scatter = new Chart(document.getElementById('chart-scatter'), {
    type: 'scatter',
    data: {
      datasets: [{ label: 'Characters', data: chars.map(c => ({ x: c.might, y: c.will, name: c.cardName })), backgroundColor: '#c9a95999', pointRadius: 5, pointHoverRadius: 8 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: items => items.map(i => i.raw.name).join(', '), label: i => `M:${i.raw.x} / W:${i.raw.y}` } }
      },
      scales: {
        x: { title: { display: true, text: 'Might', color: '#c23030' }, beginAtZero: true },
        y: { title: { display: true, text: 'Will', color: '#3a6ea5' }, beginAtZero: true }
      }
    }
  });
}

// ── Table ──
function render() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const ft = document.getElementById('filter-type').value;
  const fr = document.getElementById('filter-rarity').value;

  let filtered = cards.filter(c => {
    if (q && !`${c.cardName} ${c.effectText} ${c.cardId}`.toLowerCase().includes(q)) return false;
    if (ft && c.cardType !== ft) return false;
    if (fr && c.rarity !== fr) return false;
    return true;
  });

  filtered.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
    if (sortCol === 'cardId') return sortAsc ? cmpId(va, vb) : cmpId(vb, va);
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  document.getElementById('count').textContent = `${filtered.length} cards`;

  const tbody = document.getElementById('card-tbody');
  tbody.innerHTML = filtered.map(c => `<tr>
    <td class="cell-id">${esc(c.cardId)}</td>
    <td class="cell-name">${esc(c.cardName)}</td>
    <td><span class="cell-type" data-t="${esc(c.cardType)}">${esc(c.cardType)}</span></td>
    <td><span class="cell-rarity" data-r="${esc(c.rarity)}">${esc(c.rarity)}</span></td>
    <td class="cell-cost">${c.inspirationCost}</td>
    <td class="cell-might">${c.might || '—'}</td>
    <td class="cell-will">${c.will || '—'}</td>
    <td class="cell-effect">${esc(c.effectText)}</td>
  </tr>`).join('');
}

function cmpId(a, b) {
  const pa = a.match(/(\d+)-(\d+)/), pb = b.match(/(\d+)-(\d+)/);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  return (+pa[1] - +pb[1]) || (+pa[2] - +pb[2]);
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
