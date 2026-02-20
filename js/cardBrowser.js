/**
 * Card Browser Module
 * Handles card grid/list rendering, filtering, searching, sorting, and export.
 */

import { RARITY_ORDER, KEYWORD_DEFINITIONS } from './api.js';

let currentView = 'grid'; // 'grid' or 'list'
let filteredCards = [];
let onCardClick = null;

/**
 * Initialize the card browser with event listeners
 */
export function initCardBrowser(cards, cardClickHandler) {
  onCardClick = cardClickHandler;
  populateFilterDropdowns(cards);
  attachFilterListeners(cards);
  attachViewToggle();
  attachExportListeners();
  applyFilters(cards);
}

/**
 * Refresh the browser with new data
 */
export function refreshCardBrowser(cards) {
  populateFilterDropdowns(cards);
  applyFilters(cards);
}

/**
 * Populate filter dropdown options from actual card data
 */
function populateFilterDropdowns(cards) {
  // Types
  const types = [...new Set(cards.map(c => c.cardType).filter(Boolean))].sort();
  fillSelect('filter-type', types);

  // Rarities
  const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))].sort(
    (a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99)
  );
  fillSelect('filter-rarity', rarities);

  // Authors / Decks
  const authors = [...new Set(cards.map(c => c.author).filter(Boolean))].sort();
  const decks = [...new Set(cards.map(c => c.deckName).filter(Boolean))].sort();
  const authorDeckOptions = [
    ...authors.map(a => ({ value: `author:${a}`, label: `Author: ${a}` })),
    ...decks.map(d => ({ value: `deck:${d}`, label: `Deck: ${d}` }))
  ];
  fillSelectComplex('filter-author', authorDeckOptions);

  // Keywords
  const allKeywords = new Set();
  cards.forEach(c => {
    if (c.keywords) {
      c.keywords.split(/[,;]/).forEach(k => {
        const trimmed = k.trim();
        if (trimmed) allKeywords.add(trimmed);
      });
    }
  });
  // Also add known keywords
  Object.keys(KEYWORD_DEFINITIONS).forEach(k => allKeywords.add(k));
  fillSelect('filter-keyword', [...allKeywords].sort());
}

function fillSelect(id, options) {
  const el = document.getElementById(id);
  if (!el) return;
  const currentVal = el.value;
  // Keep first option (the "All" option)
  while (el.options.length > 1) el.remove(1);
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    el.appendChild(o);
  }
  el.value = currentVal;
}

function fillSelectComplex(id, options) {
  const el = document.getElementById(id);
  if (!el) return;
  const currentVal = el.value;
  while (el.options.length > 1) el.remove(1);
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    el.appendChild(o);
  }
  el.value = currentVal;
}

/**
 * Attach filter change listeners
 */
function attachFilterListeners(cards) {
  const ids = ['search-input', 'filter-type', 'filter-rarity', 'filter-author',
               'filter-cost-min', 'filter-cost-max', 'filter-keyword', 'sort-by'];

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const evt = el.tagName === 'INPUT' ? 'input' : 'change';
    el.addEventListener(evt, () => applyFilters(cards));
  }
}

/**
 * Apply all active filters and re-render
 */
function applyFilters(cards) {
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const type = document.getElementById('filter-type')?.value || '';
  const rarity = document.getElementById('filter-rarity')?.value || '';
  const authorDeck = document.getElementById('filter-author')?.value || '';
  const costMin = parseInt(document.getElementById('filter-cost-min')?.value) || 0;
  const costMax = parseInt(document.getElementById('filter-cost-max')?.value) || Infinity;
  const keyword = document.getElementById('filter-keyword')?.value || '';
  const sortBy = document.getElementById('sort-by')?.value || 'id';

  filteredCards = cards.filter(card => {
    // Text search
    if (search) {
      const haystack = `${card.cardName} ${card.effectText} ${card.cardId} ${card.deckName}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    // Type filter
    if (type && card.cardType !== type) return false;

    // Rarity filter
    if (rarity && card.rarity !== rarity) return false;

    // Author/Deck filter
    if (authorDeck) {
      if (authorDeck.startsWith('author:')) {
        if (card.author !== authorDeck.slice(7)) return false;
      } else if (authorDeck.startsWith('deck:')) {
        if (card.deckName !== authorDeck.slice(5)) return false;
      }
    }

    // Cost range
    if (card.inspirationCost < costMin) return false;
    if (costMax !== Infinity && card.inspirationCost > costMax) return false;

    // Keyword filter
    if (keyword) {
      const cardKeywords = (card.keywords || '').toLowerCase();
      const cardText = (card.effectText || '').toLowerCase();
      if (!cardKeywords.includes(keyword.toLowerCase()) && !cardText.includes(keyword.toLowerCase())) return false;
    }

    return true;
  });

  // Sort
  filteredCards.sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.cardName.localeCompare(b.cardName);
      case 'cost': return a.inspirationCost - b.inspirationCost;
      case 'might': return b.might - a.might;
      case 'will': return b.will - a.will;
      case 'rarity': return (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99);
      case 'type': return a.cardType.localeCompare(b.cardType);
      case 'id':
      default: return compareCardIds(a.cardId, b.cardId);
    }
  });

  // Update count
  const countEl = document.getElementById('result-count');
  if (countEl) countEl.textContent = `${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''} found`;

  // Render
  renderCards(filteredCards);
}

/**
 * Compare card IDs numerically (MOH1-3 < MOH1-13)
 */
function compareCardIds(a, b) {
  const parseId = id => {
    const match = id.match(/MOH(\d+)-(\d+)/i);
    if (!match) return [0, 0];
    return [parseInt(match[1]), parseInt(match[2])];
  };
  const [aSet, aNum] = parseId(a);
  const [bSet, bNum] = parseId(b);
  if (aSet !== bSet) return aSet - bSet;
  return aNum - bNum;
}

/**
 * Render cards in current view mode
 */
function renderCards(cards) {
  if (currentView === 'grid') {
    renderGrid(cards);
  } else {
    renderList(cards);
  }
}

/**
 * Render card grid
 */
function renderGrid(cards) {
  const grid = document.getElementById('card-grid');
  const list = document.getElementById('card-list');
  if (!grid) return;

  grid.classList.remove('hidden');
  if (list) list.classList.add('hidden');

  if (cards.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <div class="empty-state-icon">&#128214;</div>
        <div class="empty-state-text">No cards match your search</div>
      </div>`;
    return;
  }

  grid.innerHTML = cards.map(card => `
    <div class="card-tile" data-type="${escHtml(card.cardType)}" data-id="${escHtml(card.cardId)}">
      <div class="card-tile-header">
        <div class="card-tile-name">${escHtml(card.cardName)}</div>
        <div class="card-tile-cost">${card.inspirationCost}</div>
      </div>
      <div class="card-tile-meta">
        <span class="card-badge badge-type" data-type="${escHtml(card.cardType)}">${escHtml(card.cardType)}</span>
        <span class="card-badge badge-rarity" data-rarity="${escHtml(card.rarity)}">${escHtml(card.rarity)}</span>
        <span class="card-tile-id">${escHtml(card.cardId)}</span>
      </div>
      ${card.might || card.will ? `
        <div class="card-tile-stats">
          ${card.might ? `<span class="card-stat card-stat-m">M: <strong>${card.might}</strong></span>` : ''}
          ${card.will ? `<span class="card-stat card-stat-w">W: <strong>${card.will}</strong></span>` : ''}
        </div>` : ''}
      ${card.effectText ? `<div class="card-tile-text">${escHtml(card.effectText)}</div>` : ''}
      ${card.keywords ? `
        <div class="card-tile-keywords">
          ${card.keywords.split(/[,;]/).filter(k => k.trim()).map(k =>
            `<span class="keyword-tag">${escHtml(k.trim())}</span>`
          ).join('')}
        </div>` : ''}
    </div>
  `).join('');

  // Attach click listeners
  grid.querySelectorAll('.card-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.id;
      const card = cards.find(c => c.cardId === id);
      if (card && onCardClick) onCardClick(card);
    });
  });
}

/**
 * Render card list view
 */
function renderList(cards) {
  const grid = document.getElementById('card-grid');
  const list = document.getElementById('card-list');
  if (!list) return;

  if (grid) grid.classList.add('hidden');
  list.classList.remove('hidden');

  if (cards.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128214;</div>
        <div class="empty-state-text">No cards match your search</div>
      </div>`;
    return;
  }

  list.innerHTML = `
    <div class="card-list-header">
      <div>ID</div>
      <div>Name</div>
      <div>Type</div>
      <div>Cost</div>
      <div>Might</div>
      <div>Will</div>
      <div>Rarity</div>
      <div>Author</div>
    </div>
    ${cards.map(card => `
      <div class="card-list-row" data-id="${escHtml(card.cardId)}">
        <div class="list-id">${escHtml(card.cardId)}</div>
        <div class="list-name">${escHtml(card.cardName)}</div>
        <div class="list-stat"><span class="card-badge badge-type" data-type="${escHtml(card.cardType)}">${escHtml(card.cardType)}</span></div>
        <div class="list-stat" style="color: var(--gold)">${card.inspirationCost}</div>
        <div class="list-stat" style="color: var(--type-character)">${card.might || '—'}</div>
        <div class="list-stat" style="color: var(--eldritch-blue)">${card.will || '—'}</div>
        <div class="list-stat"><span class="card-badge badge-rarity" data-rarity="${escHtml(card.rarity)}">${escHtml(card.rarity)}</span></div>
        <div class="list-stat">${escHtml(card.author)}</div>
      </div>
    `).join('')}
  `;

  list.querySelectorAll('.card-list-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      const card = cards.find(c => c.cardId === id);
      if (card && onCardClick) onCardClick(card);
    });
  });
}

/**
 * View toggle (grid/list)
 */
function attachViewToggle() {
  const gridBtn = document.getElementById('view-grid');
  const listBtn = document.getElementById('view-list');

  gridBtn?.addEventListener('click', () => {
    currentView = 'grid';
    gridBtn.classList.add('active');
    listBtn?.classList.remove('active');
    renderCards(filteredCards);
  });

  listBtn?.addEventListener('click', () => {
    currentView = 'list';
    listBtn.classList.add('active');
    gridBtn?.classList.remove('active');
    renderCards(filteredCards);
  });
}

/**
 * Export listeners
 */
function attachExportListeners() {
  document.getElementById('export-csv')?.addEventListener('click', () => exportCSV(filteredCards));
  document.getElementById('export-json')?.addEventListener('click', () => exportJSON(filteredCards));
}

function exportCSV(cards) {
  const headers = ['Card ID', 'Deck Name', 'Card Name', 'Type', 'Rarity', 'Cost', 'Might', 'Will', 'Effect Text', 'Keywords', 'Author'];
  const rows = cards.map(c => [
    c.cardId, c.deckName, c.cardName, c.cardType, c.rarity,
    c.inspirationCost, c.might, c.will, `"${(c.effectText || '').replace(/"/g, '""')}"`,
    c.keywords, c.author
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadFile(csv, 'moh-cards.csv', 'text/csv');
}

function exportJSON(cards) {
  const json = JSON.stringify(cards, null, 2);
  downloadFile(json, 'moh-cards.json', 'application/json');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Escape HTML special characters
 */
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
