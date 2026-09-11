/**
 * VEDARA admin — Google Sheets sync for the real Supabase orders.
 *
 * Serverless function (Vercel Node runtime). The ONLY place the Google
 * service-account credentials are read — they never reach the browser.
 * Supabase stays the system of record for order data; this endpoint's job
 * is purely to mirror it into the "VEDARA Orders" Google Sheet and back.
 *
 * Auth: every call must carry `Authorization: Bearer <supabase-access-token>`
 * for a signed-in user whose `profiles.is_admin = true` (same rule the
 * client-side AdminGuard enforces). That same admin token is then reused to
 * read/write `orders` via Supabase's REST API — RLS's existing
 * "admin all" policy authorises it. No service-role key is ever used, here
 * or anywhere else in this project.
 *
 * Actions (all POST, chosen with ?op=):
 *   ?op=sync              Supabase -> Sheet. Upserts every order by `id`.
 *   ?op=pull               Sheet -> Supabase. Matches rows by `id` and
 *                           updates only a small, safe set of columns.
 *   ?op=mirror&id=<uuid>   Mirrors one order (fresh from Supabase) into its
 *                           Sheet row — used right after an admin edit.
 *
 * Required environment variables (Vercel -> Project Settings -> Environment
 * Variables, and .env.local for `vercel dev`) — server-only, NOT prefixed
 * with VITE_ so Vite never bundles them into the frontend:
 *   GOOGLE_SHEETS_CLIENT_EMAIL   service account email
 *   GOOGLE_SHEETS_PRIVATE_KEY    service account private key (PEM; \n is fine escaped)
 *   GOOGLE_SHEETS_ID             the spreadsheet ID (from its URL)
 *   GOOGLE_SHEETS_TAB_NAME       optional — if unset, the first tab
 *                                (gid=0, i.e. the sheet's own first tab) is
 *                                used automatically, whatever it's named
 *
 * Reuses the existing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY —
 * no new Supabase configuration needed.
 */
import crypto from 'crypto';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// The sheet's columns, in the order VEDARA Orders was created with. Only
// used as the fallback when the sheet has no header row yet — every read
// still maps by the sheet's *actual* header text, never blindly by index.
const SHEET_COLUMNS = [
  'id', 'user_id', 'order_number', 'status', 'customer_name', 'email', 'phone',
  'shipping_address', 'order_name', 'subtotal', 'discount', 'shipping', 'total',
  'payment_method', 'payment_status', 'created_at', 'updated_at', 'notes',
];

// Columns a Sheet edit is allowed to write back into Supabase. Financial
// totals, identifiers and the structured shipping address are deliberately
// excluded so a spreadsheet edit can never corrupt order math or checkout
// data — see task requirement "do not overwrite unrelated Supabase data".
const PULL_WRITABLE = ['status', 'customer_name', 'email', 'phone', 'notes'];

function env(name) {
  return (process.env[name] || '').trim();
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/* ---------------------------------------------------------- Admin auth --- */

function supabaseConfig() {
  const url = env('VITE_SUPABASE_URL');
  const anonKey = env('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !anonKey) throw httpError(500, 'Supabase is not configured on the server (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing).');
  return { url, anonKey };
}

async function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw httpError(401, 'Sign in required.');
  const { url, anonKey } = supabaseConfig();

  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } });
  if (!userRes.ok) throw httpError(401, 'Your session has expired — please sign in again.');
  const user = await userRes.json();

  const profileRes = await fetch(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
    { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } },
  );
  if (!profileRes.ok) throw httpError(403, 'Supabase: could not verify admin access.');
  const rows = await profileRes.json();
  if (!rows[0]?.is_admin) throw httpError(403, 'This account is not a VEDARA owner.');
  return token;
}

/* --------------------------------------------------------- Supabase data */

async function supabaseFetch(token, path, options = {}) {
  const { url, anonKey } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.message || json?.error_description || res.statusText;
    throw httpError(res.status === 404 ? 404 : 502, `Supabase: ${message || 'request failed'}`);
  }
  return json;
}

const ORDER_SELECT = '*,items:order_items(name,quantity)';

function fetchAllOrders(token) {
  return supabaseFetch(token, `/orders?select=${encodeURIComponent(ORDER_SELECT)}&order=created_at.desc`);
}

async function fetchOrder(token, id) {
  const rows = await supabaseFetch(token, `/orders?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(ORDER_SELECT)}`);
  if (!rows[0]) throw httpError(404, `Supabase: order ${id} was not found.`);
  return rows[0];
}

async function patchOrder(token, id, fields) {
  if (!Object.keys(fields).length) return;
  await supabaseFetch(token, `/orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  });
}

async function setOrderStatus(token, id, status) {
  await supabaseFetch(token, '/rpc/admin_set_order_status', {
    method: 'POST',
    body: JSON.stringify({ p_order_id: id, p_status: status }),
  });
}

/* ----------------------------------------------------- Google Sheets auth */

// Reused across warm invocations of the same function instance only — a
// cold start always re-authenticates. Never persisted anywhere else.
let cachedToken = null;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 30000) return cachedToken.token;

  const clientEmail = env('GOOGLE_SHEETS_CLIENT_EMAIL');
  const privateKey = env('GOOGLE_SHEETS_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw httpError(500, 'Google Sheets is not connected — GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY are missing on the server.');
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))}`;

  let signature;
  try {
    signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url');
  } catch {
    throw httpError(500, 'Google Sheets: GOOGLE_SHEETS_PRIVATE_KEY is not a valid private key. Copy the "private_key" value from the service account JSON exactly.');
  }
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw httpError(502, `Google authentication failed: ${json.error_description || json.error || 'invalid credentials'}.`);
  }

  cachedToken = { token: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

/* -------------------------------------------------------- Sheet access --- */

async function sheetsFetchRaw(path, options = {}) {
  const spreadsheetId = env('GOOGLE_SHEETS_ID');
  if (!spreadsheetId) throw httpError(500, 'Google Sheets is not connected — GOOGLE_SHEETS_ID is missing on the server.');
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const status = json.error?.status; // e.g. PERMISSION_DENIED, NOT_FOUND
    const message = json.error?.message || res.statusText;
    if (res.status === 404 || status === 'NOT_FOUND') {
      throw httpError(404, 'Google Sheet not found — check GOOGLE_SHEETS_ID (and that the "VEDARA Orders" sheet still exists at that ID).');
    }
    if (res.status === 403 || status === 'PERMISSION_DENIED') {
      throw httpError(403, `Google Sheets permission denied — share "VEDARA Orders" with ${env('GOOGLE_SHEETS_CLIENT_EMAIL') || 'the service account'} as Editor.`);
    }
    throw httpError(502, `Google Sheets: ${message}`);
  }
  return json;
}

// Cached per warm invocation only, same as the OAuth token.
let cachedTabName = null;

/** The tab to read/write. GOOGLE_SHEETS_TAB_NAME wins if set; otherwise the
 * sheet's first tab (gid=0 — the tab shown by default when you open the
 * spreadsheet) is resolved automatically, so an unrenamed "Sheet1" or any
 * other tab title works without extra configuration. */
async function resolveTabName() {
  const explicit = env('GOOGLE_SHEETS_TAB_NAME');
  if (explicit) return explicit;
  if (cachedTabName) return cachedTabName;

  const meta = await sheetsFetchRaw('?fields=sheets.properties(sheetId,title)');
  const sheets = meta.sheets || [];
  const first = sheets.find((sh) => sh.properties?.sheetId === 0) || sheets[0];
  if (!first?.properties?.title) throw httpError(404, 'The Google Sheet has no tabs — check GOOGLE_SHEETS_ID.');
  cachedTabName = first.properties.title;
  return cachedTabName;
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

/** Every row, live from the sheet. Never cached — the sheet is the source of truth for its own contents. */
async function readAll() {
  const tab = await resolveTabName();
  const data = await sheetsFetchRaw(`/values/${encodeURIComponent(tab)}`);
  const values = data.values || [];
  const headers = (values[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
  if (!headers.length) throw httpError(422, `The "${tab}" tab has no header row — add the column names in row 1 first.`);
  const rows = values.slice(1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row, i) => {
      const record = { _row: i + 2 };
      headers.forEach((h, col) => { record[h] = row[col] ?? ''; });
      return record;
    });
  return { headers, rows };
}

async function batchUpdateRows(headers, updates) {
  if (!updates.length) return;
  const tab = await resolveTabName();
  const lastCol = columnLetter(headers.length);
  await sheetsFetchRaw('/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates.map(({ row, record }) => ({
        range: `${tab}!A${row}:${lastCol}${row}`,
        values: [headers.map((h) => record[h] ?? '')],
      })),
    }),
  });
}

async function appendRows(headers, records) {
  if (!records.length) return;
  const tab = await resolveTabName();
  await sheetsFetchRaw(
    `/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: records.map((r) => headers.map((h) => r[h] ?? '')) }) },
  );
}

/* --------------------------------------------------- Supabase <-> Sheet --- */

/** Real Supabase order -> the sheet's 18 columns. Never invents a value —
 * anything not present in `orders`/`order_items` is left blank, except
 * `payment_method`, fixed to "COD" per the storefront's current checkout
 * (no payment gateway is wired up — see PrivacyPage / CheckoutPage). */
function toSheetRecord(order) {
  const addr = order.shipping_address || {};
  const addressLine = [addr.address, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean).join(', ');
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
    shipping_address: addressLine,
    order_name: itemsLine,
    subtotal: order.subtotal ?? '',
    discount: order.discount ?? '',
    shipping: order.shipping ?? '',
    total: order.total ?? '',
    payment_method: 'COD',
    payment_status: order.payment_status || '',
    created_at: order.created_at || '',
    updated_at: order.updated_at || '',
    notes: order.notes || '',
  };
}

/* ------------------------------------------------------------------ API --- */

async function opSync(token) {
  const [orders, { headers, rows }] = await Promise.all([fetchAllOrders(token), readAll()]);
  const byId = new Map(rows.map((r) => [r.id, r._row]));

  const updates = [];
  const inserts = [];
  for (const order of orders) {
    const record = toSheetRecord(order);
    const row = byId.get(order.id);
    if (row) updates.push({ row, record });
    else inserts.push(record);
  }
  await batchUpdateRows(headers.length ? headers : SHEET_COLUMNS, updates);
  await appendRows(headers.length ? headers : SHEET_COLUMNS, inserts);

  return { total: orders.length, updated: updates.length, created: inserts.length };
}

async function opPull(token) {
  const [orders, { rows }] = await Promise.all([fetchAllOrders(token), readAll()]);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  let matched = 0;
  let updated = 0;
  const skipped = [];
  for (const sheetRow of rows) {
    if (!sheetRow.id) continue;
    const order = orderById.get(sheetRow.id);
    if (!order) { skipped.push(sheetRow.id); continue; }
    matched += 1;

    const patch = {};
    for (const field of PULL_WRITABLE) {
      if (field === 'status') continue;
      const next = String(sheetRow[field] ?? '').trim();
      if (next && next !== String(order[field] ?? '')) patch[field] = next;
    }
    const nextStatus = String(sheetRow.status ?? '').trim().toLowerCase();
    const statusChanged = nextStatus && nextStatus !== order.status;

    if (Object.keys(patch).length) await patchOrder(token, order.id, patch);
    if (statusChanged) await setOrderStatus(token, order.id, nextStatus);
    if (Object.keys(patch).length || statusChanged) updated += 1;
  }

  return { matched, updated, skipped: skipped.length };
}

async function opMirror(token, id) {
  if (!id) throw httpError(400, 'Missing order id.');
  const [order, { headers, rows }] = await Promise.all([fetchOrder(token, id), readAll()]);
  const record = toSheetRecord(order);
  const existing = rows.find((r) => r.id === id);
  if (existing) await batchUpdateRows(headers.length ? headers : SHEET_COLUMNS, [{ row: existing._row, record }]);
  else await appendRows(headers.length ? headers : SHEET_COLUMNS, [record]);
  return record;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      throw httpError(405, 'Method not allowed.');
    }
    const token = await requireAdmin(req);
    const op = String(req.query.op || '');

    if (op === 'sync') { res.status(200).json(await opSync(token)); return; }
    if (op === 'pull') { res.status(200).json(await opPull(token)); return; }
    if (op === 'mirror') { res.status(200).json(await opMirror(token, String(req.query.id || ''))); return; }

    throw httpError(400, 'Unknown operation — expected ?op=sync, ?op=pull or ?op=mirror.');
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[api/sheet-orders]', err);
    res.status(status).json({ error: err.message || 'Something went wrong.' });
  }
}
