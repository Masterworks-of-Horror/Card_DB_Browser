/**
 * Keywords Reference Module
 * Displays keyword definitions and links to cards that use them.
 */

import { KEYWORD_DEFINITIONS } from './api.js';

/**
 * Render the keywords reference page
 */
export function renderKeywords(cards) {
  const container = document.getElementById('keywords-content');
  if (!container) return;

  // Build keyword-to-cards mapping
  const keywordCards = {};

  // Initialize with known keywords
  for (const kw of Object.keys(KEYWORD_DEFINITIONS)) {
    keywordCards[kw] = [];
  }

  // Scan all cards for keywords
  for (const card of cards) {
    const foundKeywords = new Set();

    // From explicit keywords field
    if (card.keywords) {
      card.keywords.split(/[,;]/).forEach(k => {
        const trimmed = k.trim();
        if (trimmed) foundKeywords.add(trimmed);
      });
    }

    // From effect text (detect known keywords)
    if (card.effectText) {
      const lower = card.effectText.toLowerCase();
      for (const kw of Object.keys(KEYWORD_DEFINITIONS)) {
        if (lower.includes(kw.toLowerCase())) {
          foundKeywords.add(kw);
        }
      }
    }

    // Add card to each keyword's list
    for (const kw of foundKeywords) {
      if (!keywordCards[kw]) keywordCards[kw] = [];
      // Avoid duplicates
      if (!keywordCards[kw].find(c => c.cardId === card.cardId)) {
        keywordCards[kw].push(card);
      }
    }
  }

  // Sort keywords alphabetically
  const sortedKeywords = Object.keys(keywordCards).sort();

  container.innerHTML = sortedKeywords.map(kw => {
    const def = KEYWORD_DEFINITIONS[kw];
    const kwCards = keywordCards[kw];

    return `
      <div class="keyword-card">
        <div class="keyword-card-name">${escHtml(kw)}</div>
        ${def ? `
          <div class="keyword-card-desc">${escHtml(def.description)}</div>
          <div class="keyword-card-mechanic" style="font-size: 0.8rem; color: var(--gold-dim); margin-bottom: 0.5rem; font-style: italic;">
            ${escHtml(def.mechanic)}
          </div>
        ` : `
          <div class="keyword-card-desc" style="font-style: italic; color: var(--text-muted);">
            No definition available — found in card data.
          </div>
        `}
        <div class="keyword-card-cards">
          <strong>Cards (${kwCards.length}):</strong>
          ${kwCards.length > 0 ?
            kwCards.slice(0, 15).map(c => `<span style="color: var(--parchment)">${escHtml(c.cardName)}</span>`).join(', ') +
            (kwCards.length > 15 ? ` <span style="color: var(--text-muted)">... +${kwCards.length - 15} more</span>` : '')
          : '<span style="color: var(--text-muted)">None detected</span>'}
        </div>
      </div>
    `;
  }).join('');

  if (sortedKeywords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128218;</div>
        <div class="empty-state-text">No keywords found in card data</div>
      </div>
    `;
  }
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
