/**
 * Dashboard Module
 * Renders overview statistics and Chart.js visualizations.
 */

import { RARITY_ORDER } from './api.js';

// Chart.js global defaults for the gothic theme
const CHART_COLORS = {
  gold: '#c9a959',
  goldBright: '#e8c94a',
  blood: '#c23030',
  green: '#2d8a4e',
  purple: '#6b3fa0',
  blue: '#3a6ea5',
  parchment: '#e8dcc8',
  muted: '#6d6352',
  gridLine: 'rgba(201, 169, 89, 0.08)',
  gridBorder: 'rgba(201, 169, 89, 0.15)',
};

const TYPE_COLORS = {
  Character: '#c23030',
  Setting: '#2d8a4e',
  Narrative: '#6b3fa0',
  Item: '#c9a959',
  Plot: '#3a6ea5',
  Author: '#e8c94a',
  Unknown: '#555'
};

const RARITY_COLORS = {
  Common: '#8a8a8a',
  Rare: '#3a6ea5',
  Epic: '#6b3fa0',
  Fabled: '#e8c94a',
  Unknown: '#555'
};

const AUTHOR_COLORS = {
  Poe: '#c23030',
  Lovecraft: '#2d8a4e',
  GogolQuiroga: '#6b3fa0',
  ShelleyStoker: '#3a6ea5',
  SonglingUeda: '#e8c94a',
  Unknown: '#555'
};

let charts = {};

/**
 * Configure Chart.js defaults
 */
function configureChartDefaults() {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.color = CHART_COLORS.parchment;
  Chart.defaults.borderColor = CHART_COLORS.gridBorder;
  Chart.defaults.font.family = "'Crimson Text', serif";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(13, 13, 26, 0.95)';
  Chart.defaults.plugins.tooltip.titleFont = { family: "'Cinzel', serif", weight: '600' };
  Chart.defaults.plugins.tooltip.borderColor = CHART_COLORS.gold;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  Chart.defaults.plugins.tooltip.padding = 10;
}

/**
 * Render the dashboard with stats and charts
 */
export function renderDashboard(cards) {
  configureChartDefaults();
  renderStatCards(cards);
  renderCharts(cards);
}

/**
 * Update stat summary cards
 */
function renderStatCards(cards) {
  const counts = {};
  for (const card of cards) {
    const type = card.cardType || 'Unknown';
    counts[type] = (counts[type] || 0) + 1;
  }

  setText('stat-total', cards.length);
  setText('stat-characters', counts['Character'] || 0);
  setText('stat-settings', counts['Setting'] || 0);
  setText('stat-narratives', counts['Narrative'] || 0);
  setText('stat-items', counts['Item'] || 0);
  setText('stat-plots', counts['Plot'] || 0);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Render all charts
 */
function renderCharts(cards) {
  // Destroy existing charts
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  renderCostCurve(cards);
  renderRarityChart(cards);
  renderAuthorChart(cards);
  renderMightWillChart(cards);
  renderTypesChart(cards);
  renderAvgStatsByCost(cards);
}

/**
 * Cost Curve - bar chart showing number of cards at each cost
 */
function renderCostCurve(cards) {
  const ctx = document.getElementById('chart-cost-curve');
  if (!ctx) return;

  const costCounts = {};
  cards.forEach(c => {
    const cost = c.inspirationCost;
    costCounts[cost] = (costCounts[cost] || 0) + 1;
  });

  const labels = Object.keys(costCounts).sort((a, b) => parseInt(a) - parseInt(b));
  const data = labels.map(l => costCounts[l]);

  charts.costCurve = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(l => `${l} IC`),
      datasets: [{
        label: 'Cards',
        data: data,
        backgroundColor: CHART_COLORS.gold + '80',
        borderColor: CHART_COLORS.gold,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `Inspiration Cost: ${labels[items[0].dataIndex]}`,
            label: item => `${item.raw} card${item.raw !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: CHART_COLORS.gridLine }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Rarity distribution - doughnut chart
 */
function renderRarityChart(cards) {
  const ctx = document.getElementById('chart-rarity');
  if (!ctx) return;

  const rarityCounts = {};
  cards.forEach(c => {
    const r = c.rarity || 'Unknown';
    rarityCounts[r] = (rarityCounts[r] || 0) + 1;
  });

  const labels = Object.keys(rarityCounts).sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99));
  const data = labels.map(l => rarityCounts[l]);
  const colors = labels.map(l => RARITY_COLORS[l] || '#555');

  charts.rarity = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      cutout: '55%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: item => `${item.label}: ${item.raw} (${Math.round(item.raw / cards.length * 100)}%)`
          }
        }
      }
    }
  });
}

/**
 * Cards by Author - horizontal bar chart
 */
function renderAuthorChart(cards) {
  const ctx = document.getElementById('chart-author');
  if (!ctx) return;

  const authorCounts = {};
  cards.forEach(c => {
    const a = c.author || 'Unknown';
    authorCounts[a] = (authorCounts[a] || 0) + 1;
  });

  const labels = Object.keys(authorCounts).sort((a, b) => authorCounts[b] - authorCounts[a]);
  const data = labels.map(l => authorCounts[l]);
  const colors = labels.map(l => AUTHOR_COLORS[l] || '#555');

  charts.author = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cards',
        data,
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: CHART_COLORS.gridLine }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Might vs Will scatter plot (characters only)
 */
function renderMightWillChart(cards) {
  const ctx = document.getElementById('chart-might-will');
  if (!ctx) return;

  const characters = cards.filter(c => c.cardType === 'Character' && (c.might || c.will));

  // Group by cost for coloring
  const datasets = {};
  characters.forEach(c => {
    const cost = c.inspirationCost;
    if (!datasets[cost]) {
      datasets[cost] = {
        label: `${cost} IC`,
        data: [],
        backgroundColor: getCostColor(cost),
        borderColor: getCostColor(cost),
        pointRadius: 6,
        pointHoverRadius: 9,
      };
    }
    datasets[cost].data.push({
      x: c.might,
      y: c.will,
      name: c.cardName,
      id: c.cardId
    });
  });

  charts.mightWill = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: Object.values(datasets)
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 8 } },
        tooltip: {
          callbacks: {
            title: items => items.map(i => i.raw.name).join(', '),
            label: item => `M:${item.raw.x} / W:${item.raw.y} (${item.dataset.label})`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Might', color: CHART_COLORS.blood },
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine }
        },
        y: {
          title: { display: true, text: 'Will', color: CHART_COLORS.blue },
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine }
        }
      }
    }
  });
}

/**
 * Card types breakdown - polar area chart
 */
function renderTypesChart(cards) {
  const ctx = document.getElementById('chart-types');
  if (!ctx) return;

  const typeCounts = {};
  cards.forEach(c => {
    const t = c.cardType || 'Unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const labels = Object.keys(typeCounts).sort();
  const data = labels.map(l => typeCounts[l]);
  const colors = labels.map(l => TYPE_COLORS[l] || '#555');

  charts.types = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + '80'),
        borderColor: colors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        r: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine },
          ticks: { display: false }
        }
      }
    }
  });
}

/**
 * Average stats by cost - line chart
 */
function renderAvgStatsByCost(cards) {
  const ctx = document.getElementById('chart-avg-stats');
  if (!ctx) return;

  const characters = cards.filter(c => c.cardType === 'Character');
  const byCost = {};

  characters.forEach(c => {
    const cost = c.inspirationCost;
    if (!byCost[cost]) byCost[cost] = { might: [], will: [], count: 0 };
    byCost[cost].might.push(c.might);
    byCost[cost].will.push(c.will);
    byCost[cost].count++;
  });

  const costs = Object.keys(byCost).sort((a, b) => parseInt(a) - parseInt(b));
  const avgMight = costs.map(c => avg(byCost[c].might));
  const avgWill = costs.map(c => avg(byCost[c].will));
  const cardCount = costs.map(c => byCost[c].count);

  charts.avgStats = new Chart(ctx, {
    type: 'line',
    data: {
      labels: costs.map(c => `${c} IC`),
      datasets: [
        {
          label: 'Avg Might',
          data: avgMight,
          borderColor: CHART_COLORS.blood,
          backgroundColor: CHART_COLORS.blood + '20',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
        },
        {
          label: 'Avg Will',
          data: avgWill,
          borderColor: CHART_COLORS.blue,
          backgroundColor: CHART_COLORS.blue + '20',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            afterLabel: item => `${cardCount[item.dataIndex]} character${cardCount[item.dataIndex] !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Utility: get a color based on cost tier
 */
function getCostColor(cost) {
  const colors = [
    '#2d8a4e', '#3a6ea5', '#6b3fa0', '#c9a959',
    '#c23030', '#e8c94a', '#8b1a1a', '#4a0e4e',
    '#1a472a', '#2d1b69', '#a52a2a'
  ];
  return colors[cost % colors.length];
}

/**
 * Utility: calculate average of number array
 */
function avg(arr) {
  if (!arr.length) return 0;
  return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
}
