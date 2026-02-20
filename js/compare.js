/**
 * Card Comparison Module
 * Side-by-side comparison of up to 4 cards with stat highlighting.
 */

let allCards = [];
let selectedCards = [null, null, null, null];

/**
 * Initialize the comparison tool
 */
export function initCompare(cards) {
  allCards = cards;
  attachSearchListeners();
}

/**
 * Refresh with new card data
 */
export function refreshCompare(cards) {
  allCards = cards;
  renderComparison();
}

/**
 * Add a card to comparison (called from card detail modal)
 */
export function addToCompare(card) {
  // Find first empty slot
  const emptyIdx = selectedCards.indexOf(null);
  if (emptyIdx === -1) {
    // Replace last slot
    selectedCards[3] = card;
  } else {
    selectedCards[emptyIdx] = card;
  }
  // Update the search inputs
  updateSearchInputs();
  renderComparison();
}

/**
 * Attach autocomplete search listeners
 */
function attachSearchListeners() {
  document.querySelectorAll('.compare-search').forEach(input => {
    const slot = parseInt(input.dataset.slot);
    const suggestionsEl = input.closest('.compare-slot').querySelector('.compare-suggestions');

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase().trim();
      if (query.length < 1) {
        suggestionsEl.classList.add('hidden');
        return;
      }

      const matches = allCards.filter(c =>
        c.cardName.toLowerCase().includes(query) ||
        c.cardId.toLowerCase().includes(query)
      ).slice(0, 8);

      if (matches.length === 0) {
        suggestionsEl.classList.add('hidden');
        return;
      }

      suggestionsEl.innerHTML = matches.map(c => `
        <div class="compare-suggestion" data-id="${escHtml(c.cardId)}">
          <span class="suggest-name">${escHtml(c.cardName)}</span>
          <span class="suggest-id">${escHtml(c.cardId)}</span>
        </div>
      `).join('');
      suggestionsEl.classList.remove('hidden');

      suggestionsEl.querySelectorAll('.compare-suggestion').forEach(item => {
        item.addEventListener('click', () => {
          const card = allCards.find(c => c.cardId === item.dataset.id);
          if (card) {
            selectedCards[slot] = card;
            input.value = card.cardName;
            suggestionsEl.classList.add('hidden');
            renderComparison();
          }
        });
      });
    });

    // Hide suggestions on blur
    input.addEventListener('blur', () => {
      setTimeout(() => suggestionsEl.classList.add('hidden'), 200);
    });
  });
}

/**
 * Update search input values to reflect selected cards
 */
function updateSearchInputs() {
  document.querySelectorAll('.compare-search').forEach(input => {
    const slot = parseInt(input.dataset.slot);
    const card = selectedCards[slot];
    if (card) {
      input.value = card.cardName;
    }
  });
}

/**
 * Render the comparison results
 */
function renderComparison() {
  const container = document.getElementById('compare-results');
  if (!container) return;

  const active = selectedCards.filter(Boolean);

  if (active.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <div class="empty-state-icon">&#9878;</div>
        <div class="empty-state-text">Search and select cards above to compare</div>
      </div>
    `;
    return;
  }

  // Determine min/max for highlighting
  const numericFields = ['inspirationCost', 'might', 'will', 'durability', 'actionSpeed'];
  const stats = {};
  for (const field of numericFields) {
    const values = active.map(c => c[field] || 0).filter(v => v > 0);
    stats[field] = {
      max: Math.max(...values, 0),
      min: Math.min(...values, Infinity)
    };
  }

  container.innerHTML = active.map((card, idx) => {
    const slotIdx = selectedCards.indexOf(card);

    return `
      <div class="compare-card" data-type="${escHtml(card.cardType)}">
        <button class="compare-card-remove" data-slot="${slotIdx}">&times;</button>
        <div class="compare-card-name">${escHtml(card.cardName)}</div>
        <div style="margin-bottom: 0.5rem;">
          <span class="card-badge badge-type" data-type="${escHtml(card.cardType)}">${escHtml(card.cardType)}</span>
          <span class="card-badge badge-rarity" data-rarity="${escHtml(card.rarity)}">${escHtml(card.rarity)}</span>
          <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); margin-left: 0.25rem;">${escHtml(card.cardId)}</span>
        </div>
        ${renderCompareStatRow('Cost', card.inspirationCost, stats.inspirationCost, true)}
        ${renderCompareStatRow('Might', card.might, stats.might, false)}
        ${renderCompareStatRow('Will', card.will, stats.will, false)}
        ${card.durability ? renderCompareStatRow('Durability', card.durability, stats.durability, false) : ''}
        ${card.actionSpeed ? renderCompareStatRow('Action Speed', card.actionSpeed, stats.actionSpeed, false) : ''}
        ${renderCompareStatRow('Author', card.author, null, false, true)}
        ${card.effectText ? `
          <div class="compare-effect-text">${escHtml(card.effectText)}</div>
        ` : ''}
        ${card.keywords ? `
          <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem;">
            ${card.keywords.split(/[,;]/).filter(k => k.trim()).map(k =>
              `<span class="keyword-tag">${escHtml(k.trim())}</span>`
            ).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Remove card listeners
  container.querySelectorAll('.compare-card-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot);
      selectedCards[slot] = null;
      // Clear the search input
      const input = document.querySelector(`.compare-search[data-slot="${slot}"]`);
      if (input) input.value = '';
      renderComparison();
    });
  });
}

/**
 * Render a single stat row with comparison highlighting
 */
function renderCompareStatRow(label, value, range, lowerIsBetter, isText = false) {
  let className = '';
  if (!isText && range && value > 0) {
    if (value === range.max && range.max !== range.min) {
      className = lowerIsBetter ? 'lowest' : 'highest';
    } else if (value === range.min && range.max !== range.min) {
      className = lowerIsBetter ? 'highest' : 'lowest';
    }
  }

  const displayValue = isText ? value : (value || '—');

  return `
    <div class="compare-stat-row">
      <span class="compare-stat-label">${label}</span>
      <span class="compare-stat-value ${className}">${escHtml(String(displayValue))}</span>
    </div>
  `;
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
