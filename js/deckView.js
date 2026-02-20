/**
 * Deck/Author View Module
 * Groups cards by author and deck, showing composition breakdowns.
 */

import { AUTHORS, RARITY_ORDER } from './api.js';

/**
 * Render the Decks & Authors page
 */
export function renderDeckView(cards, onCardClick) {
  const container = document.getElementById('decks-content');
  if (!container) return;

  // Group by author
  const byAuthor = {};
  for (const card of cards) {
    const author = card.author || 'Unknown';
    if (!byAuthor[author]) byAuthor[author] = [];
    byAuthor[author].push(card);
  }

  // Sort authors: known authors first, then alphabetical
  const sortedAuthors = Object.keys(byAuthor).sort((a, b) => {
    const aKnown = AUTHORS.includes(a);
    const bKnown = AUTHORS.includes(b);
    if (aKnown && !bKnown) return -1;
    if (!aKnown && bKnown) return 1;
    return a.localeCompare(b);
  });

  container.innerHTML = sortedAuthors.map(author => {
    const authorCards = byAuthor[author];
    const stats = computeAuthorStats(authorCards);
    const authorDisplay = formatAuthorName(author);

    return `
      <div class="author-section" data-author="${escHtml(author)}">
        <div class="author-header" data-toggle="${escHtml(author)}">
          <h2 class="author-name">${escHtml(authorDisplay)}</h2>
          <span class="author-count">${authorCards.length} card${authorCards.length !== 1 ? 's' : ''} &#9660;</span>
        </div>
        <div class="author-stats">
          <div class="author-stat-item">Characters: <span>${stats.characters}</span></div>
          <div class="author-stat-item">Settings: <span>${stats.settings}</span></div>
          <div class="author-stat-item">Narratives: <span>${stats.narratives}</span></div>
          <div class="author-stat-item">Items: <span>${stats.items}</span></div>
          <div class="author-stat-item">Plots: <span>${stats.plots}</span></div>
          <div class="author-stat-item">Avg Cost: <span>${stats.avgCost}</span></div>
          <div class="author-stat-item">Avg Might: <span>${stats.avgMight}</span></div>
          <div class="author-stat-item">Avg Will: <span>${stats.avgWill}</span></div>
        </div>
        <div class="author-cards" id="author-cards-${escHtml(author)}">
          ${renderAuthorCards(authorCards)}
        </div>
      </div>
    `;
  }).join('');

  // Attach toggle listeners
  container.querySelectorAll('.author-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.author-section');
      const cards = section.querySelector('.author-cards');
      const stats = section.querySelector('.author-stats');
      const isHidden = cards.style.display === 'none';
      cards.style.display = isHidden ? '' : 'none';
      stats.style.display = isHidden ? '' : 'none';
      const arrow = header.querySelector('.author-count');
      if (arrow) {
        arrow.innerHTML = arrow.innerHTML.replace(/[▼▲]|&#9660;|&#9650;/g, '') +
          (isHidden ? ' &#9660;' : ' &#9650;');
      }
    });
  });

  // Attach card click listeners
  container.querySelectorAll('.card-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.id;
      const card = cards.find(c => c.cardId === id);
      if (card && onCardClick) onCardClick(card);
    });
  });
}

/**
 * Compute summary stats for an author's cards
 */
function computeAuthorStats(cards) {
  const typeCounts = { characters: 0, settings: 0, narratives: 0, items: 0, plots: 0 };
  let totalCost = 0, totalMight = 0, totalWill = 0;
  let mightCount = 0, willCount = 0;

  for (const c of cards) {
    switch (c.cardType) {
      case 'Character': typeCounts.characters++; break;
      case 'Setting': typeCounts.settings++; break;
      case 'Narrative': typeCounts.narratives++; break;
      case 'Item': typeCounts.items++; break;
      case 'Plot': typeCounts.plots++; break;
    }
    totalCost += c.inspirationCost;
    if (c.might) { totalMight += c.might; mightCount++; }
    if (c.will) { totalWill += c.will; willCount++; }
  }

  return {
    ...typeCounts,
    avgCost: cards.length ? (totalCost / cards.length).toFixed(1) : '—',
    avgMight: mightCount ? (totalMight / mightCount).toFixed(1) : '—',
    avgWill: willCount ? (totalWill / willCount).toFixed(1) : '—',
  };
}

/**
 * Render card tiles for an author section
 */
function renderAuthorCards(cards) {
  // Sort by type, then cost
  const sorted = [...cards].sort((a, b) => {
    const typeOrder = { Character: 0, Setting: 1, Item: 2, Narrative: 3, Plot: 4, Author: 5 };
    const ta = typeOrder[a.cardType] ?? 99;
    const tb = typeOrder[b.cardType] ?? 99;
    if (ta !== tb) return ta - tb;
    return a.inspirationCost - b.inspirationCost;
  });

  return sorted.map(card => `
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
    </div>
  `).join('');
}

/**
 * Format author name for display
 */
function formatAuthorName(author) {
  const names = {
    'Poe': 'Edgar Allan Poe',
    'Lovecraft': 'H.P. Lovecraft',
    'GogolQuiroga': 'Gogol & Quiroga',
    'ShelleyStoker': 'Shelley & Stoker',
    'SonglingUeda': 'Songling & Ueda',
    'Unknown': 'Unattributed'
  };
  return names[author] || author;
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
