/**
 * Google Sheets Data Fetcher for MOH Match Telemetry
 *
 * Actual spreadsheet columns:
 *   A: Timestamp
 *   B: Player ID
 *   C: Author Card ID
 *   D: Deck Card List (JSON array)
 *   E: Server ID
 *   F: Page Change Logs (JSON array of {amount, reason, sourceCard, act})
 *   G: Player Card Play Counts (dict "cardId:cardName": count)
 *   H: Act 1 Card Plays (JSON array)
 *   I: Act 2 Card Plays (JSON array)
 *   J: Act 3 Card Plays (JSON array)
 */

const SPREADSHEET_ID = '1AqB6cMJH5i2mjp5RY_mfwzmmxTie48vVyFhnoEh4BoI';
const CACHE_KEY = 'moh_match_data';
const CACHE_TS_KEY = 'moh_match_data_ts';
const CACHE_MS = 5 * 60 * 1000;

export async function fetchMatchData(force = false) {
  if (!force) {
    const cached = getCache();
    if (cached) return cached;
  }

  let rows;
  try {
    rows = await fetchJSON();
  } catch (e) {
    console.warn('JSON fetch failed, trying CSV:', e);
    rows = await fetchCSV();
  }

  const matches = rows.map(parseRow).filter(Boolean);
  setCache(matches);
  return matches;
}

async function fetchJSON() {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
  const res = await fetch(url);
  const text = await res.text();
  const m = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?/s);
  if (!m) throw new Error('Bad response');
  const json = JSON.parse(m[1]);
  if (!json.table?.rows?.length) throw new Error('No rows');

  return json.table.rows.map(row =>
    row.c ? row.c.map(cell => {
      if (!cell) return '';
      // Handle date objects from Google Sheets
      if (cell.f) return cell.f;
      return cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
    }) : []
  );
}

async function fetchCSV() {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`);
  if (!res.ok) throw new Error('CSV failed');
  const text = await res.text();
  const rows = parseCSVText(text);
  return rows.slice(1); // skip header
}

function parseRow(values) {
  if (!values || values.length < 5 || !values[0]) return null;

  const timestamp = values[0] || '';
  const playerId = values[1] || '';
  const authorCardId = values[2] || '';
  const deckRaw = values[3] || '[]';
  const serverId = values[4] || '';
  const pageLogsRaw = values[5] || '[]';
  const playCountsRaw = values[6] || '{}';
  const act1Raw = values[7] || '[]';
  const act2Raw = values[8] || '[]';
  const act3Raw = values[9] || '[]';

  return {
    timestamp: parseTimestamp(timestamp),
    timestampRaw: timestamp,
    playerId,
    authorCardId,
    deck: safeJSON(deckRaw, []),
    serverId,
    pageLogs: safeJSON(pageLogsRaw, []),
    playCounts: safeJSON(playCountsRaw, {}),
    act1Plays: safeJSON(act1Raw, []),
    act2Plays: safeJSON(act2Raw, []),
    act3Plays: safeJSON(act3Raw, []),
  };
}

function parseTimestamp(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function safeJSON(str, fallback) {
  try { return JSON.parse(str); }
  catch { return fallback; }
}

function parseCSVText(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || (ch === '\r' && nx === '\n')) {
        row.push(field); field = '';
        if (row.some(f => f.trim())) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else field += ch;
    }
  }
  if (field || row.length) { row.push(field); if (row.some(f => f.trim())) rows.push(row); }
  return rows;
}

function getCache(ignoreExpiry = false) {
  try {
    const ts = localStorage.getItem(CACHE_TS_KEY);
    const d = localStorage.getItem(CACHE_KEY);
    if (!d || !ts) return null;
    if (!ignoreExpiry && Date.now() - +ts > CACHE_MS) return null;
    return JSON.parse(d);
  } catch { return null; }
}

function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {}
}
