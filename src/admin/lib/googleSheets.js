/**
 * VEDARA admin — Google Sheets connection for the Orders page.
 *
 * Google Identity Services (GIS) "token client" — the browser-only OAuth
 * flow Google designed for exactly this case: a signed-in admin authorizes
 * THIS site, in a popup, to read/write ONE Google API on their behalf. There
 * is no client secret and no service account: `VITE_GOOGLE_CLIENT_ID` is a
 * public identifier (safe in frontend code, same as Google's own docs show),
 * and the resulting access token lives only in `sessionStorage` for the
 * current browser tab, never sent anywhere but Google's own API.
 *
 * Supabase remains the system of record. This module only mirrors Supabase
 * orders into the "VEDARA Orders" spreadsheet — nothing here is read back
 * into Supabase.
 *
 * Environment variables (Vite — safe to expose, neither is a secret):
 *   VITE_GOOGLE_CLIENT_ID       OAuth 2.0 Client ID (Web application)
 *   VITE_GOOGLE_SHEETS_ID       the spreadsheet ID (from its URL)
 *   VITE_GOOGLE_SHEETS_TAB_NAME optional — defaults to the sheet's first tab
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_KEY = 'vedara-admin-google-token';
const REQUEST_TIMEOUT_MS = 15000;

// The real `orders` columns this sync writes. Any other column already in
// the sheet (e.g. a "Replay" or "Payment" note column an admin added by
// hand) is never touched — see syncOrdersToSheet.
const KNOWN_FIELDS = [
  'id', 'user_id', 'order_number', 'status', 'customer_name', 'email', 'phone',
  'shipping_address', 'order_name', 'subtotal', 'discount', 'shipping', 'total',
  'payment_method', 'payment_status', 'created_at', 'updated_at', 'notes',
];

function env(name) {
  return (import.meta.env[name] || '').trim();
}

/* --------------------------------------------------------------- Setup --- */

function clientId() {
  const id = env('VITE_GOOGLE_CLIENT_ID');
  if (!id) throw new Error('Google Sheets isn’t configured — set VITE_GOOGLE_CLIENT_ID.');
  return id;
}

function spreadsheetId() {
  const id = env('VITE_GOOGLE_SHEETS_ID');
  if (!id) throw new Error('Google Sheets isn’t configured — set VITE_GOOGLE_SHEETS_ID.');
  return id;
}

let gisPromise = null;
/**
 * Loads the Google Identity Services script ahead of time. Call this once
 * when the Order Sheet page mounts (not from the Connect click) — if the
 * script has to be fetched over the network *during* the click, the popup
 * that follows arrives late enough that browsers no longer treat it as
 * directly triggered by the click, and silently block/close it.
 */
export function preloadGoogleSheets() {
  loadGis().catch(() => { /* connectGoogleSheet() will surface this on click */ });
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => { gisPromise = null; reject(new Error('Could not load Google Sign-In — check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return gisPromise;
}

/* ---------------------------------------------------------- Token state --- */

function readToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

function writeToken(token, expiresInSeconds) {
  try {
    // Refresh a minute early so a near-expiry token never fails mid-sync.
    const expiresAt = Date.now() + (Number(expiresInSeconds) || 3600) * 1000 - 60000;
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — the connection
    // just won't survive a page refresh; reconnecting is one click.
  }
}

function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
}

/** Is there a live (unexpired) Google connection right now? Synchronous — safe for initial render. */
export function isGoogleSheetConnected() {
  return Boolean(readToken());
}

function describeAuthError(type) {
  if (type === 'popup_failed_to_open') {
    return 'Your browser blocked the Google sign-in window — allow pop-ups for this site and click Connect Google Sheet again.';
  }
  if (type === 'popup_closed') {
    return 'The Google sign-in window closed before finishing — click Connect Google Sheet and try again, or check your browser isn’t blocking pop-ups for this site.';
  }
  if (type === 'access_denied') {
    return 'Google access wasn’t granted — click Connect Google Sheet and approve access to Google Sheets.';
  }
  return 'Could not connect to Google — please try again.';
}

/** Opens Google's consent popup. Resolves once an access token is stored. */
export async function connectGoogleSheet() {
  await loadGis();
  const id = clientId();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) { reject(new Error(describeAuthError(resp.error))); return; }
        writeToken(resp.access_token, resp.expires_in);
        resolve(resp.access_token);
      },
      error_callback: (err) => reject(new Error(describeAuthError(err?.type))),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** Revoke and forget the current connection. */
export function disconnectGoogleSheet() {
  const token = readToken();
  clearToken();
  if (token && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(token, () => {}); } catch { /* best-effort */ }
  }
}

/* -------------------------------------------------------- Sheets access --- */

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Google Sheets took too long to respond — please try again.');
    throw new Error('Could not reach Google Sheets — check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}

async function sheetsFetch(path, options = {}) {
  const token = readToken();
  if (!token) throw new Error('Connect Google Sheet first.');

  const res = await fetchWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const status = json.error?.status;
    if (res.status === 401 || status === 'UNAUTHENTICATED') {
      clearToken();
      throw new Error('Your Google connection expired — click Connect Google Sheet again.');
    }
    if (res.status === 403) {
      const detail = json.error?.message || status || 'Permission denied.';
      // Google reports "API disabled" and "no file access" both as 403 —
      // always surface its real message so we're never guessing which one it is.
      if (/has not been used|it is disabled|SERVICE_DISABLED/i.test(detail)) {
        throw new Error(`The Google Sheets API isn’t enabled for this Google Cloud project yet. Google said: "${detail}"`);
      }
      throw new Error(`This Google account doesn’t have edit access to the sheet — open it in Google Drive and share it with the account you connected. (Google said: "${detail}")`);
    }
    if (res.status === 404 || status === 'NOT_FOUND') {
      throw new Error('The Google Sheet wasn’t found — check VITE_GOOGLE_SHEETS_ID.');
    }
    throw new Error(`Google Sheets: ${json.error?.message || res.statusText || 'request failed'}.`);
  }
  return json;
}

let cachedTab = null;

/** The tab to read/write. VITE_GOOGLE_SHEETS_TAB_NAME wins; otherwise the
 * sheet's first tab (gid=0) is used automatically. */
async function resolveTab() {
  const explicit = env('VITE_GOOGLE_SHEETS_TAB_NAME');
  if (explicit) return explicit;
  if (cachedTab) return cachedTab;
  const meta = await sheetsFetch('?fields=sheets.properties(sheetId,title)');
  const list = meta.sheets || [];
  const first = list.find((sh) => sh.properties?.sheetId === 0) || list[0];
  if (!first?.properties?.title) throw new Error('The Google Sheet has no tabs.');
  cachedTab = first.properties.title;
  return cachedTab;
}

function columnLetter(n) {
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Every row of the sheet, live — headers taken exactly as they appear in
 * row 1, whatever they are (never assumes the 18 order columns). Used both
 * to display the sheet as-is and, internally, to diff against for syncing.
 */
export async function readSheet() {
  const tab = await resolveTab();
  const data = await sheetsFetch(`/values/${encodeURIComponent(tab)}`);
  const values = data.values || [];
  const headers = (values[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
  if (!headers.length) throw new Error(`The "${tab}" tab has no header row — add the column names in row 1 first.`);
  const rows = values.slice(1)
    .filter((row) => row.some((c) => String(c ?? '').trim() !== ''))
    .map((row, i) => {
      const record = { _row: i + 2 };
      headers.forEach((h, col) => { record[h] = row[col] ?? ''; });
      return record;
    });
  return { tab, headers, rows };
}

/** A Supabase order (with `.items` from order_items) -> the sheet's known fields.
 * Handles empty/null Supabase values safely — every field falls back to ''. */
function orderToSheetFields(order) {
  const itemsLine = (order.items || [])
    .map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name))
    .join(', ');
  return {
    id: order.id,
    user_id: order.user_id || '',
    order_number: order.order_number || '',
    status: order.status || '',
    customer_name: order.customer_name || '',
    email: order.email || '',
    phone: order.phone || '',
    shipping_address: JSON.stringify(order.shipping_address || {}),
    order_name: itemsLine,
    subtotal: order.subtotal ?? '',
    discount: order.discount ?? '',
    shipping: order.shipping ?? '',
    total: order.total ?? '',
    // This storefront has no payment gateway (no payment_method/payment_status
    // columns in `orders` yet) — every order is fulfilled COD today.
    payment_method: order.payment_method || 'COD',
    payment_status: order.payment_status || '',
    created_at: order.created_at || '',
    updated_at: order.updated_at || '',
    notes: order.notes || '',
  };
}

/**
 * Mirrors Supabase orders into the sheet, matched by `id`:
 *   - known id  -> update only that row's known-field cells (any other
 *                  column in the sheet, e.g. "Replay"/"Payment", is left
 *                  completely untouched)
 *   - unknown id -> append one new row
 * Never invents rows and never duplicates one — a second sync of the same
 * orders is a no-op (every field already matches).
 */
export async function syncOrdersToSheet(orders) {
  const { tab, headers, rows } = await readSheet();
  const rowById = new Map(rows.map((r) => [r.id, r._row]));

  const cellUpdates = [];
  const newRows = [];
  let updated = 0;
  let created = 0;

  for (const order of orders) {
    const fields = orderToSheetFields(order);
    const existingRow = rowById.get(order.id);
    if (existingRow) {
      for (const field of KNOWN_FIELDS) {
        const col = headers.indexOf(field);
        if (col === -1) continue; // sheet doesn't have this column — nothing to write
        const colLetter = columnLetter(col + 1);
        cellUpdates.push({ range: `${tab}!${colLetter}${existingRow}:${colLetter}${existingRow}`, values: [[fields[field]]] });
      }
      updated += 1;
    } else {
      newRows.push(headers.map((h) => fields[h] ?? ''));
      created += 1;
    }
  }

  if (cellUpdates.length) {
    await sheetsFetch('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: cellUpdates }),
    });
  }
  if (newRows.length) {
    await sheetsFetch(`/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: newRows }),
    });
  }

  return { total: orders.length, created, updated };
}
