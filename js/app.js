/**
 * Masters of Horror — Card Database
 * Main Application Shell
 *
 * Handles routing, data loading, card detail modal, and module coordination.
 */

import { fetchCardData, getLastUpdatedTime, KEYWORD_DEFINITIONS } from './api.js';
import { initCardBrowser, refreshCardBrowser } from './cardBrowser.js';
import { renderDashboard } from './dashboard.js';
import { renderDeckView } from './deckView.js';
import { renderKeywords } from './keywords.js';
import { initCompare, refreshCompare, addToCompare } from './compare.js';

// ── State ──
let cardData = [];
let currentPage = 'dashboard';

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  setupRouting();
  setupModal();
  setupRefreshButton();

  // Load data
  await loadData();
});

/**
 * Load data from Google Sheets
 */
async function loadData(forceRefresh = false) {
  const overlay = document.getElementById('loading-overlay');

  try {
    if (overlay) overlay.classList.remove('hidden');
    cardData = await fetchCardData(forceRefresh);

    // Initialize all modules
    initCardBrowser(cardData, showCardDetail);
    renderDashboard(cardData);
    renderDeckView(cardData, showCardDetail);
    renderKeywords(cardData);
    initCompare(cardData);

    // Update last-updated timestamp
    updateTimestamp();

    // Navigate to current page
    navigateTo(currentPage);
  } catch (err) {
    console.error('Failed to load card data:', err);
    showError(err.message);
  } finally {
    if (overlay) overlay.classList.add('hidden');
  }
}

/**
 * Show an error message to the user
 */
function showError(message) {
  const main = document.querySelector('.main-content');
  if (!main) return;

  const errorEl = document.createElement('div');
  errorEl.className = 'empty-state';
  errorEl.style.marginTop = '3rem';
  errorEl.innerHTML = `
    <div class="empty-state-icon">&#9888;</div>
    <div class="empty-state-text" style="color: var(--blood-bright);">Failed to Load Data</div>
    <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
      ${escHtml(message)}
    </p>
    <p style="color: var(--text-muted); margin-top: 1rem; font-size: 0.9rem;">
      Ensure the Google Sheet is shared as "Anyone with the link can view".
    </p>
    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="location.reload()">
      Retry
    </button>
  `;

  // Insert at the top of main content
  main.prepend(errorEl);
}

// ── Routing ──

function setupRouting() {
  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const page = location.hash.slice(1) || 'dashboard';
    navigateTo(page);
  });

  // Handle nav link clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const page = link.dataset.page;
      if (page) {
        e.preventDefault();
        location.hash = page;
      }
    });
  });

  // Set initial page from hash
  const initialPage = location.hash.slice(1) || 'dashboard';
  navigateTo(initialPage);
}

function navigateTo(page) {
  const validPages = ['dashboard', 'cards', 'decks', 'keywords', 'compare'];
  if (!validPages.includes(page)) page = 'dashboard';

  currentPage = page;

  // Update page visibility
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Scroll to top
  window.scrollTo(0, 0);
}

// ── Card Detail Modal ──

function setupModal() {
  const modal = document.getElementById('card-modal');
  if (!modal) return;

  // Close button
  modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal());

  // Backdrop click
  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => closeModal());

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function showCardDetail(card) {
  const modal = document.getElementById('card-modal');
  const body = document.getElementById('modal-body');
  if (!modal || !body) return;

  body.innerHTML = renderCardDetail(card);
  modal.classList.remove('hidden');

  // Attach "Add to Compare" button
  body.querySelector('.detail-add-compare .btn')?.addEventListener('click', () => {
    addToCompare(card);
    closeModal();
    location.hash = 'compare';
  });
}

function closeModal() {
  const modal = document.getElementById('card-modal');
  if (modal) modal.classList.add('hidden');
}

function renderCardDetail(card) {
  const hasStats = card.cardType === 'Character' || card.might || card.will;

  // Extract individual keywords
  const keywords = card.keywords
    ? card.keywords.split(/[,;]/).map(k => k.trim()).filter(Boolean)
    : [];

  // Highlight keywords in effect text
  const highlightedText = highlightKeywords(card.effectText || '');

  return `
    <div class="detail-type-bar" data-type="${escHtml(card.cardType)}"></div>

    <div class="detail-header">
      <div>
        <h2 class="detail-name">${escHtml(card.cardName)}</h2>
      </div>
      <div class="detail-cost">${card.inspirationCost}</div>
    </div>

    <div class="detail-badges">
      <span class="card-badge badge-type" data-type="${escHtml(card.cardType)}">${escHtml(card.cardType)}</span>
      <span class="card-badge badge-rarity" data-rarity="${escHtml(card.rarity)}">${escHtml(card.rarity)}</span>
      <span class="detail-id">${escHtml(card.cardId)}</span>
      ${card.deckName ? `<span style="color: var(--text-muted); font-size: 0.8rem;">Deck: ${escHtml(card.deckName)}</span>` : ''}
      ${card.author && card.author !== 'Unknown' ? `<span style="color: var(--text-muted); font-size: 0.8rem;">Author: ${escHtml(card.author)}</span>` : ''}
    </div>

    ${hasStats ? `
      <div class="detail-stats">
        <div class="detail-stat">
          <div class="detail-stat-value might">${card.might || '—'}</div>
          <div class="detail-stat-label">Might</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value will">${card.will || '—'}</div>
          <div class="detail-stat-label">Will</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value cost">${card.inspirationCost}</div>
          <div class="detail-stat-label">Cost</div>
        </div>
        ${card.durability ? `
          <div class="detail-stat">
            <div class="detail-stat-value">${card.durability}</div>
            <div class="detail-stat-label">Durability</div>
          </div>
        ` : ''}
        ${card.actionSpeed ? `
          <div class="detail-stat">
            <div class="detail-stat-value">${card.actionSpeed}</div>
            <div class="detail-stat-label">Speed</div>
          </div>
        ` : ''}
      </div>
    ` : ''}

    ${card.effectText ? `
      <hr class="detail-divider">
      <div class="detail-section-title">Effect Text</div>
      <div class="detail-effect-text">${highlightedText}</div>
    ` : ''}

    ${keywords.length > 0 ? `
      <hr class="detail-divider">
      <div class="detail-section-title">Keywords</div>
      <div class="detail-keywords">
        ${keywords.map(k => {
          const def = KEYWORD_DEFINITIONS[k];
          const title = def ? def.description : '';
          return `<span class="detail-keyword" title="${escAttr(title)}">${escHtml(k)}</span>`;
        }).join('')}
      </div>
    ` : ''}

    ${card.literaryAcclaim ? `
      <hr class="detail-divider">
      <div class="detail-meta-row">
        <span class="detail-meta-label">Literary Acclaim</span>
        <span>${card.literaryAcclaim}</span>
      </div>
    ` : ''}

    ${card.act ? `
      <div class="detail-meta-row">
        <span class="detail-meta-label">Act</span>
        <span>Act ${card.act}</span>
      </div>
    ` : ''}

    <div class="detail-add-compare">
      <button class="btn btn-ghost">Add to Comparison</button>
    </div>
  `;
}

/**
 * Highlight known keywords in effect text
 */
function highlightKeywords(text) {
  if (!text) return '';
  let result = escHtml(text);

  for (const kw of Object.keys(KEYWORD_DEFINITIONS)) {
    const regex = new RegExp(`\\b(${escRegex(kw)})\\b`, 'gi');
    result = result.replace(regex, '<span class="keyword-tag" style="display:inline; font-size: 0.85rem;">$1</span>');
  }

  return result;
}

// ── Refresh Button ──

function setupRefreshButton() {
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="refresh-icon" style="animation: spin 1s linear infinite;">&#8635;</span> Syncing...';
    }
    await loadData(true);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="refresh-icon">&#8635;</span> Sync';
    }
  });
}

function updateTimestamp() {
  const el = document.getElementById('last-updated');
  const time = getLastUpdatedTime();
  if (el && time) {
    el.textContent = `Last synced: ${time}`;
  }
}

// ── Utilities ──

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
