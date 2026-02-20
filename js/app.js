import { fetchMatchData } from './api.js';

let allMatches = [];
let chartInstances = {};

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  document.getElementById('refresh-btn').addEventListener('click', () => load(true));
  document.getElementById('date-from').addEventListener('change', render);
  document.getElementById('date-to').addEventListener('change', render);
  document.getElementById('date-clear').addEventListener('click', () => {
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    render();
  });
});

async function load(force = false) {
  try {
    allMatches = await fetchMatchData(force);
    render();
  } catch (e) {
    document.querySelector('main').innerHTML =
      `<p style="color:var(--blood);text-align:center;margin-top:3rem">Failed to load: ${esc(e.message)}<br><br>Make sure the Google Sheet is shared publicly.</p>`;
  }
}

function getFiltered() {
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;
  return allMatches.filter(m => {
    if (!m.timestamp) return true;
    if (from && m.timestamp < new Date(from + 'T00:00:00')) return false;
    if (to && m.timestamp > new Date(to + 'T23:59:59')) return false;
    return true;
  });
}

function render() {
  const matches = getFiltered();
  document.getElementById('match-count').textContent = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;
  renderStats(matches);
  renderCharts(matches);
  renderMatchTable(matches);
  renderCardFreq(matches);
}

// ── Stats ──
function renderStats(matches) {
  const uniquePlayers = new Set(matches.map(m => m.playerId)).size;
  const uniqueServers = new Set(matches.map(m => m.serverId)).size;
  const totalCardsPlayed = matches.reduce((sum, m) => {
    const counts = m.playCounts;
    if (typeof counts === 'object' && !Array.isArray(counts)) {
      return sum + Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
    }
    return sum;
  }, 0);
  const totalPageEvents = matches.reduce((s, m) => s + (Array.isArray(m.pageLogs) ? m.pageLogs.length : 0), 0);

  document.getElementById('stats-bar').innerHTML = [
    stat(matches.length, 'Matches'),
    stat(uniquePlayers, 'Players'),
    stat(uniqueServers, 'Servers'),
    stat(totalCardsPlayed, 'Cards Played'),
    stat(totalPageEvents, 'Page Events'),
  ].join('');
}

function stat(val, label) {
  return `<div class="stat"><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div>`;
}

// ── Charts ──
function renderCharts(matches) {
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};
  Chart.defaults.color = '#a89b85';
  Chart.defaults.borderColor = 'rgba(201,169,89,0.1)';
  Chart.defaults.font.family = "'Crimson Text', serif";

  // Author popularity
  const authMap = {};
  matches.forEach(m => {
    const a = m.authorCardId || 'Unknown';
    authMap[a] = (authMap[a] || 0) + 1;
  });
  const authLabels = Object.keys(authMap).sort((a, b) => authMap[b] - authMap[a]);
  chartInstances.authors = new Chart(document.getElementById('chart-authors'), {
    type: 'bar',
    data: {
      labels: authLabels,
      datasets: [{ data: authLabels.map(l => authMap[l]), backgroundColor: '#c9a95980', borderColor: '#c9a959', borderWidth: 1, borderRadius: 4 }]
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
  });

  // Most played cards (top 15)
  const cardMap = {};
  matches.forEach(m => {
    const counts = m.playCounts;
    if (typeof counts === 'object' && !Array.isArray(counts)) {
      for (const [key, val] of Object.entries(counts)) {
        const name = key.includes(':') ? key.split(':').slice(1).join(':') : key;
        cardMap[name] = (cardMap[name] || 0) + (Number(val) || 0);
      }
    }
  });
  const topCards = Object.entries(cardMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
  chartInstances.cards = new Chart(document.getElementById('chart-cards'), {
    type: 'bar',
    data: {
      labels: topCards.map(c => c[0]),
      datasets: [{ data: topCards.map(c => c[1]), backgroundColor: '#c2303080', borderColor: '#c23030', borderWidth: 1, borderRadius: 4 }]
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
  });

  // Page changes by reason
  const reasonMap = {};
  matches.forEach(m => {
    if (!Array.isArray(m.pageLogs)) return;
    m.pageLogs.forEach(log => {
      const r = log.reason || 'Unknown';
      if (!reasonMap[r]) reasonMap[r] = { gain: 0, loss: 0 };
      const amt = Number(log.amount) || 0;
      if (amt > 0) reasonMap[r].gain += amt;
      else reasonMap[r].loss += Math.abs(amt);
    });
  });
  const reasonLabels = Object.keys(reasonMap).sort((a, b) => (reasonMap[b].gain + reasonMap[b].loss) - (reasonMap[a].gain + reasonMap[a].loss));
  chartInstances.pages = new Chart(document.getElementById('chart-pages'), {
    type: 'bar',
    data: {
      labels: reasonLabels,
      datasets: [
        { label: 'Gained', data: reasonLabels.map(r => reasonMap[r].gain), backgroundColor: '#2d8a4e99', borderColor: '#2d8a4e', borderWidth: 1 },
        { label: 'Lost', data: reasonLabels.map(r => reasonMap[r].loss), backgroundColor: '#c2303099', borderColor: '#c23030', borderWidth: 1 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: false }, y: { beginAtZero: true } }
    }
  });

  // Card plays per act
  let act1 = 0, act2 = 0, act3 = 0;
  matches.forEach(m => {
    act1 += Array.isArray(m.act1Plays) ? m.act1Plays.reduce((s, c) => s + (c.count || 1), 0) : 0;
    act2 += Array.isArray(m.act2Plays) ? m.act2Plays.reduce((s, c) => s + (c.count || 1), 0) : 0;
    act3 += Array.isArray(m.act3Plays) ? m.act3Plays.reduce((s, c) => s + (c.count || 1), 0) : 0;
  });
  chartInstances.acts = new Chart(document.getElementById('chart-acts'), {
    type: 'doughnut',
    data: {
      labels: ['Act 1', 'Act 2', 'Act 3'],
      datasets: [{ data: [act1, act2, act3], backgroundColor: ['#c9a95999', '#3a6ea599', '#6b3fa099'], borderColor: ['#c9a959', '#3a6ea5', '#6b3fa0'], borderWidth: 2 }]
    },
    options: { responsive: true, cutout: '50%', plugins: { legend: { position: 'bottom' } } }
  });
}

// ── Match Table ──
function renderMatchTable(matches) {
  const tbody = document.getElementById('match-tbody');
  tbody.innerHTML = matches.map(m => {
    const totalPlayed = typeof m.playCounts === 'object' && !Array.isArray(m.playCounts)
      ? Object.values(m.playCounts).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
    const netPages = Array.isArray(m.pageLogs)
      ? m.pageLogs.reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0;
    const acts = [
      m.act1Plays?.length ? '1' : '',
      m.act2Plays?.length ? '2' : '',
      m.act3Plays?.length ? '3' : '',
    ].filter(Boolean).join(', ') || '—';

    return `<tr>
      <td class="cell-id">${esc(formatDate(m.timestamp))}</td>
      <td>${esc(m.playerId)}</td>
      <td class="cell-name">${esc(m.authorCardId)}</td>
      <td class="cell-id">${esc(m.serverId)}</td>
      <td style="text-align:center">${m.deck?.length || 0}</td>
      <td style="text-align:center;color:var(--gold)">${totalPlayed}</td>
      <td style="text-align:center;color:${netPages >= 0 ? 'var(--green)' : 'var(--blood)'}">${netPages >= 0 ? '+' : ''}${netPages}</td>
      <td style="text-align:center">${acts}</td>
    </tr>`;
  }).join('');
}

// ── Card Frequency Table ──
function renderCardFreq(matches) {
  const cardMap = {};
  const matchesWithCard = {};
  matches.forEach(m => {
    const counts = m.playCounts;
    if (typeof counts === 'object' && !Array.isArray(counts)) {
      const seen = new Set();
      for (const [key, val] of Object.entries(counts)) {
        const name = key.includes(':') ? key.split(':').slice(1).join(':') : key;
        cardMap[name] = (cardMap[name] || 0) + (Number(val) || 0);
        if (!seen.has(name)) { matchesWithCard[name] = (matchesWithCard[name] || 0) + 1; seen.add(name); }
      }
    }
  });

  const sorted = Object.entries(cardMap).sort((a, b) => b[1] - a[1]);
  const total = matches.length || 1;
  const tbody = document.getElementById('card-freq-tbody');
  tbody.innerHTML = sorted.map(([name, count]) => {
    const pct = Math.round((matchesWithCard[name] || 0) / total * 100);
    return `<tr>
      <td class="cell-name">${esc(name)}</td>
      <td style="text-align:center;color:var(--gold)">${count}</td>
      <td style="text-align:center">${pct}%</td>
    </tr>`;
  }).join('');
}

function formatDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
