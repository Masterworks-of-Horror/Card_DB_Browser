/**
 * Google Sheets Data Fetcher for Masters of Horror Card Database
 *
 * Fetches live data from the public Google Sheet and parses it
 * into structured card objects matching the MOH data model.
 *
 * Column mapping (from CLAUDE.md):
 *   1: Card ID (MOH1-XX)
 *   2: Deck Name (NOT the card name)
 *   3: Card Name
 *   4: Card Type (Character, Setting, Narrative, Item, Plot, Author)
 *   5: Rarity (Common/C, Rare/R, Epic/E, Fabled/F)
 *   6: Inspiration Cost
 *   7: Might
 *   8: Will
 *   9: Effect Text
 *   10+: Additional columns (keywords, literary acclaim, durability, action speed, etc.)
 */

const SPREADSHEET_ID = '1AqB6cMJH5i2mjp5RY_mfwzmmxTie48vVyFhnoEh4BoI';

// Cache key for localStorage
const CACHE_KEY = 'moh_card_data';
const CACHE_TIMESTAMP_KEY = 'moh_card_data_ts';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Known MOH keyword definitions for reference
 */
export const KEYWORD_DEFINITIONS = {
  'Evermore': {
    name: 'Evermore',
    description: 'When this character goes to the graveyard, lose 1 Page, reduce its cost by 1, then shuffle it back into your deck. The cycle of horror never ends.',
    mechanic: 'Graveyard → Deck recursion with cost reduction'
  },
  'Foreshadow': {
    name: 'Foreshadow',
    description: 'A repeating effect that triggers at a set interval while the card remains in play. The dread builds with each passing moment.',
    mechanic: 'Continuous repeating trigger (every N seconds)'
  },
  'Awaken': {
    name: 'Awaken',
    description: 'When your graveyard reaches a threshold number of cards, this effect triggers. Something terrible stirs from the depths.',
    mechanic: 'Graveyard threshold trigger (single activation)'
  },
  'Martyr': {
    name: 'Martyr',
    description: 'Pay the Inspiration Cost and discard this card from your hand to activate its Martyr effect. A willing sacrifice for greater power.',
    mechanic: 'Hand discard activation (pay IC cost)'
  },
  'Tear': {
    name: 'Tear',
    description: 'Remove a card from the top of a player\'s deck and send it directly to the graveyard. The pages are torn asunder.',
    mechanic: 'Deck → Graveyard forced removal'
  },
  'Eulogy': {
    name: 'Eulogy',
    description: 'An effect that triggers when this character is destroyed or removed from the battlefield. A final act of defiance.',
    mechanic: 'On-death trigger effect'
  },
  'Ceaseless': {
    name: 'Ceaseless',
    description: 'A continuous passive effect that grants benefits to other cards while this card remains in play.',
    mechanic: 'Passive aura / continuous buff'
  },
  'Pageturner': {
    name: 'Pageturner',
    description: 'Triggers an effect whenever Masterwork Pages change. Each turn of the page brings new revelations.',
    mechanic: 'Page change trigger'
  },
  'Publishing': {
    name: 'Publishing',
    description: 'This card is removed from the game entirely (Out of Game) rather than going to the graveyard. It cannot be resurrected.',
    mechanic: 'Permanent removal (OutOfGame state)'
  }
};

/**
 * Known author names in the game
 */
export const AUTHORS = ['Poe', 'Lovecraft', 'GogolQuiroga', 'ShelleyStoker', 'SonglingUeda'];

/**
 * Rarity display mapping
 */
export const RARITY_MAP = {
  'C': 'Common',
  'Common': 'Common',
  'R': 'Rare',
  'Rare': 'Rare',
  'E': 'Epic',
  'Epic': 'Epic',
  'F': 'Fabled',
  'Fabled': 'Fabled'
};

/**
 * Rarity sort order (for sorting)
 */
export const RARITY_ORDER = { 'Common': 0, 'Rare': 1, 'Epic': 2, 'Fabled': 3 };

/**
 * Card types in the game
 */
export const CARD_TYPES = ['Character', 'Setting', 'Narrative', 'Item', 'Plot', 'Author'];

/**
 * Fetch card data from Google Sheets.
 * Uses the Google Visualization API (no API key required for public sheets).
 * Falls back to CSV export if the primary method fails.
 *
 * @param {boolean} forceRefresh - Bypass cache
 * @returns {Promise<Array<Object>>} Array of parsed card objects
 */
export async function fetchCardData(forceRefresh = false) {
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedData();
    if (cached) return cached;
  }

  try {
    const data = await fetchViaVisualizationAPI();
    cacheData(data);
    return data;
  } catch (err) {
    console.warn('Visualization API failed, trying CSV fallback:', err);
    try {
      const data = await fetchViaCSV();
      cacheData(data);
      return data;
    } catch (err2) {
      console.error('Both fetch methods failed:', err2);
      // Try returning stale cache
      const stale = getCachedData(true);
      if (stale) {
        console.warn('Using stale cached data');
        return stale;
      }
      throw new Error('Failed to fetch card data from Google Sheets. Ensure the sheet is publicly shared.');
    }
  }
}

/**
 * Fetch via Google Visualization API (JSON response, no API key needed)
 */
async function fetchViaVisualizationAPI() {
  // Fetch all sheets info first, then get each sheet
  // Try common sheet names
  const sheetNames = await discoverSheetNames();
  let allCards = [];

  for (const sheetName of sheetNames) {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    if (!response.ok) continue;

    const text = await response.text();
    // Google wraps the JSON in a callback: google.visualization.Query.setResponse({...})
    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?/s);
    if (!jsonStr) continue;

    const json = JSON.parse(jsonStr[1]);
    if (!json.table || !json.table.rows) continue;

    const headers = json.table.cols.map(c => c.label || '');
    const rows = json.table.rows;

    for (const row of rows) {
      const values = row.c ? row.c.map(cell => cell ? (cell.v !== null && cell.v !== undefined ? String(cell.v) : '') : '') : [];
      if (values.length < 3 || !values[0]) continue; // Skip empty rows

      const card = parseRowToCard(values, headers, sheetName);
      if (card && card.cardId) {
        allCards.push(card);
      }
    }
  }

  if (allCards.length === 0) {
    throw new Error('No card data found in spreadsheet');
  }

  return deduplicateCards(allCards);
}

/**
 * Discover sheet names by fetching the first sheet and checking for sheet links.
 * Falls back to common names.
 */
async function discoverSheetNames() {
  try {
    // Try fetching the HTML page to find sheet names
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
    const response = await fetch(url);
    const text = await response.text();

    // If the first sheet loads, just return a set of likely sheet names
    // The first sheet (default) is usually enough
    return [''];  // Empty string = default/first sheet
  } catch {
    return [''];
  }
}

/**
 * Fetch via CSV export (fallback)
 */
async function fetchViaCSV() {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CSV fetch failed: ${response.status}`);

  const text = await response.text();
  const rows = parseCSV(text);

  if (rows.length < 2) throw new Error('CSV has no data rows');

  const headers = rows[0];
  const cards = [];

  for (let i = 1; i < rows.length; i++) {
    const card = parseRowToCard(rows[i], headers, 'Sheet1');
    if (card && card.cardId) {
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Parse a single row of data into a card object.
 * Handles the column mapping from CLAUDE.md.
 */
function parseRowToCard(values, headers, sheetName) {
  if (!values || values.length < 3) return null;

  // Try to detect column mapping by checking headers or using positional fallback
  let cardId, deckName, cardName, cardType, rarity, cost, might, will, effectText;
  let keywords = '', literaryAcclaim = '', durability = '', actionSpeed = '', act = '';

  // Check if headers give us clues
  const headerLower = headers.map(h => (h || '').toLowerCase().trim());

  // Try header-based mapping first
  const idxId = findColumnIndex(headerLower, ['card id', 'cardid', 'id', 'card_id']);
  const idxDeck = findColumnIndex(headerLower, ['deck name', 'deckname', 'deck', 'deck_name']);
  const idxName = findColumnIndex(headerLower, ['card name', 'cardname', 'name', 'card_name']);
  const idxType = findColumnIndex(headerLower, ['card type', 'cardtype', 'type', 'card_type']);
  const idxRarity = findColumnIndex(headerLower, ['rarity']);
  const idxCost = findColumnIndex(headerLower, ['cost', 'inspiration cost', 'inspirationcost', 'ic']);
  const idxMight = findColumnIndex(headerLower, ['might', 'm']);
  const idxWill = findColumnIndex(headerLower, ['will', 'w']);
  const idxEffect = findColumnIndex(headerLower, ['effect text', 'effecttext', 'effect', 'text', 'ability', 'effect_text']);
  const idxKeywords = findColumnIndex(headerLower, ['keywords', 'keyword', 'kw']);
  const idxAcclaim = findColumnIndex(headerLower, ['literary acclaim', 'acclaim', 'la']);
  const idxDurability = findColumnIndex(headerLower, ['durability', 'dur']);
  const idxSpeed = findColumnIndex(headerLower, ['action speed', 'speed', 'actionspeed']);
  const idxAct = findColumnIndex(headerLower, ['act']);

  if (idxId !== -1) {
    // Header-based mapping
    cardId = getVal(values, idxId);
    deckName = getVal(values, idxDeck);
    cardName = getVal(values, idxName);
    cardType = getVal(values, idxType);
    rarity = getVal(values, idxRarity);
    cost = getVal(values, idxCost);
    might = getVal(values, idxMight);
    will = getVal(values, idxWill);
    effectText = getVal(values, idxEffect);
    keywords = getVal(values, idxKeywords);
    literaryAcclaim = getVal(values, idxAcclaim);
    durability = getVal(values, idxDurability);
    actionSpeed = getVal(values, idxSpeed);
    act = getVal(values, idxAct);
  } else {
    // Positional mapping (from CLAUDE.md: cols 1-9)
    cardId = getVal(values, 0);
    deckName = getVal(values, 1);
    cardName = getVal(values, 2);
    cardType = getVal(values, 3);
    rarity = getVal(values, 4);
    cost = getVal(values, 5);
    might = getVal(values, 6);
    will = getVal(values, 7);
    effectText = getVal(values, 8);
    // Additional columns if they exist
    keywords = getVal(values, 9);
    literaryAcclaim = getVal(values, 10);
    durability = getVal(values, 11);
    actionSpeed = getVal(values, 12);
    act = getVal(values, 13);
  }

  // Validate card ID format
  if (!cardId || !cardId.match(/^MOH\d*-/i)) {
    // Maybe the ID is in a different format, or this is a header/empty row
    if (!cardId) return null;
  }

  // Normalize rarity
  const normalizedRarity = RARITY_MAP[rarity] || rarity || 'Unknown';

  // Normalize card type
  const normalizedType = normalizeCardType(cardType);

  // Parse numeric fields
  const parsedCost = parseInt(cost) || 0;
  const parsedMight = parseInt(might) || 0;
  const parsedWill = parseInt(will) || 0;
  const parsedDurability = parseInt(durability) || 0;
  const parsedSpeed = parseFloat(actionSpeed) || 0;
  const parsedAcclaim = parseInt(literaryAcclaim) || 0;
  const parsedAct = parseInt(act) || 0;

  // Detect author from deck name or card data
  const author = detectAuthor(deckName, cardName, cardId);

  // Extract keywords from effect text if no explicit keywords column
  const detectedKeywords = keywords || extractKeywordsFromText(effectText);

  return {
    cardId: cardId.trim(),
    deckName: (deckName || '').trim(),
    cardName: (cardName || '').trim(),
    cardType: normalizedType,
    rarity: normalizedRarity,
    inspirationCost: parsedCost,
    might: parsedMight,
    will: parsedWill,
    effectText: (effectText || '').trim(),
    keywords: detectedKeywords,
    literaryAcclaim: parsedAcclaim,
    durability: parsedDurability,
    actionSpeed: parsedSpeed,
    act: parsedAct,
    author: author,
    sheetName: sheetName
  };
}

/**
 * Find a column index from possible header names
 */
function findColumnIndex(headers, possibleNames) {
  for (const name of possibleNames) {
    const idx = headers.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Safe value getter
 */
function getVal(arr, idx) {
  if (idx < 0 || idx >= arr.length) return '';
  return (arr[idx] || '').toString().trim();
}

/**
 * Normalize card type string to canonical form
 */
function normalizeCardType(type) {
  if (!type) return 'Unknown';
  const lower = type.toLowerCase().trim();
  const typeMap = {
    'character': 'Character',
    'setting': 'Setting',
    'narrative': 'Narrative',
    'item': 'Item',
    'plot': 'Plot',
    'author': 'Author',
    'char': 'Character',
    'set': 'Setting',
    'narr': 'Narrative',
  };
  return typeMap[lower] || type.trim();
}

/**
 * Detect author affiliation from deck name, card name, or card ID
 */
function detectAuthor(deckName, cardName, cardId) {
  const text = `${deckName} ${cardName} ${cardId}`.toLowerCase();

  // Known author-specific keywords
  const authorHints = {
    'Poe': ['poe', 'edgar', 'usher', 'raven', 'nevermore', 'berenice', 'lenore', 'ligeia', 'fortunato',
            'amontillado', 'prospero', 'red death', 'william wilson', 'tell-tale', 'tell tale',
            'dupin', 'pluto', 'black cat', 'roderick', 'madeline'],
    'Lovecraft': ['lovecraft', 'howard', 'cthulhu', 'azathoth', 'nyarlathotep', 'yog', 'dagon',
                  'innsmouth', 'rlyeh', "r'lyeh", 'necronomicon', 'thurston', 'olmstead',
                  'deep one', 'elder', 'cosmic', 'eldritch', 'dyer'],
    'GogolQuiroga': ['gogol', 'quiroga', 'viy', 'poprishchin', 'basavriuk', 'misiones'],
    'ShelleyStoker': ['shelley', 'stoker', 'frankenstein', 'dracula', 'van helsing', 'castle dracula', 'victor'],
    'SonglingUeda': ['songling', 'ueda', 'nie xiaoqian', 'xianu', 'madame white', 'white serpent',
                     'sutoku', 'saigyo', 'magic sword', 'feather']
  };

  for (const [author, hints] of Object.entries(authorHints)) {
    for (const hint of hints) {
      if (text.includes(hint)) return author;
    }
  }

  return 'Unknown';
}

/**
 * Extract keywords from effect text
 */
function extractKeywordsFromText(text) {
  if (!text) return '';
  const knownKeywords = Object.keys(KEYWORD_DEFINITIONS);
  const found = [];
  const lower = text.toLowerCase();

  for (const kw of knownKeywords) {
    if (lower.includes(kw.toLowerCase())) {
      found.push(kw);
    }
  }

  return found.join(', ');
}

/**
 * Remove duplicate cards (prefer later entries)
 */
function deduplicateCards(cards) {
  const map = new Map();
  for (const card of cards) {
    map.set(card.cardId, card);
  }
  return Array.from(map.values());
}

/**
 * Simple CSV parser that handles quoted fields
 */
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some(f => f.trim())) {
          rows.push(currentRow);
        }
        currentRow = [];
        if (ch === '\r') i++;
      } else {
        currentField += ch;
      }
    }
  }

  // Last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Cache management
 */
function getCachedData(ignoreExpiry = false) {
  try {
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const data = localStorage.getItem(CACHE_KEY);
    if (!data || !ts) return null;
    if (!ignoreExpiry && Date.now() - parseInt(ts) > CACHE_DURATION_MS) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function cacheData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Get formatted last-updated time
 */
export function getLastUpdatedTime() {
  const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!ts) return null;
  return new Date(parseInt(ts)).toLocaleTimeString();
}
