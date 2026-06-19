// src/lib/insforge.js
// InsForge REST API client — no SDK, pure fetch

const BASE_URL = process.env.REACT_APP_INSFORGE_URL || process.env.VITE_INSFORGE_URL;
const ANON_KEY = process.env.REACT_APP_INSFORGE_ANON_KEY || process.env.VITE_INSFORGE_ANON_KEY;

if (!BASE_URL || !ANON_KEY) {
  throw new Error(
    "Missing InsForge env vars. Set REACT_APP_INSFORGE_URL and REACT_APP_INSFORGE_ANON_KEY."
  );
}

// ── Auth token management ─────────────────────────────────────────────────────

let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

function authHeaders(extraHeaders = {}) {
  const token = _accessToken || ANON_KEY;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

// ── Health check ─────────────────────────────────────────────────────────────

export async function healthCheck() {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`InsForge health check failed: ${res.status}`);
  return res.json();
}

// ── Authentication ────────────────────────────────────────────────────────────

export async function register(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Registration failed");
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/sessions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Login failed");
  if (data.accessToken) setAccessToken(data.accessToken);
  return data;
}

export async function logout() {
  const res = await fetch(`${BASE_URL}/api/auth/sessions`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  clearAccessToken();
  return res.ok;
}

export async function getCurrentUser() {
  const res = await fetch(`${BASE_URL}/api/auth/users/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function sendResetPasswordEmail(email) {
  const res = await fetch(`${BASE_URL}/api/auth/email/send-reset-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to send reset email");
  return data;
}

export async function exchangeResetPasswordToken(email, code) {
  const res = await fetch(`${BASE_URL}/api/auth/email/exchange-reset-password-token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to verify reset code");
  return data;
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${BASE_URL}/api/auth/email/reset-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to reset password");
  return data;
}

// ── Database — Query records ──────────────────────────────────────────────────

/**
 * Query records from a table.
 * @param {string} table - Table name
 * @param {Object} params - Query params: { limit, offset, order, select, ...filters }
 */
export async function queryRecords(table, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/api/database/records/${table}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Query failed on ${table}`);
  return {
    data,
    total: parseInt(res.headers.get("X-Total-Count") || "0", 10),
  };
}

// ── Database — Create records ─────────────────────────────────────────────────

export async function createRecords(table, records) {
  const res = await fetch(`${BASE_URL}/api/database/records/${table}`, {
    method: "POST",
    headers: authHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(Array.isArray(records) ? records : [records]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Create failed on ${table}`);
  return data;
}

// ── Database — Update records ─────────────────────────────────────────────────

export async function updateRecords(table, filters, updates) {
  const qs = new URLSearchParams(filters).toString();
  const res = await fetch(
    `${BASE_URL}/api/database/records/${table}?${qs}`,
    {
      method: "PATCH",
      headers: authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(updates),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Update failed on ${table}`);
  return data;
}

// ── Database — Delete records ─────────────────────────────────────────────────

export async function deleteRecords(table, filters) {
  const qs = new URLSearchParams(filters).toString();
  const res = await fetch(
    `${BASE_URL}/api/database/records/${table}?${qs}`,
    {
      method: "DELETE",
      headers: authHeaders({ Prefer: "return=representation" }),
    }
  );
  if (res.status === 204) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Delete failed on ${table}`);
  return data;
}

// ── Database — Upsert ─────────────────────────────────────────────────────────

export async function upsertRecords(table, records) {
  const res = await fetch(`${BASE_URL}/api/database/records/${table}`, {
    method: "POST",
    headers: authHeaders({
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(Array.isArray(records) ? records : [records]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Upsert failed on ${table}`);
  return data;
}

// ── Database — Raw SQL (admin, server-side only) ──────────────────────────────

export async function rawSQL(query, params = []) {
  const res = await fetch(`${BASE_URL}/api/database/advance/rawsql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Raw SQL failed");
  return data;
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function uploadFile(bucket, key, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(
    `${BASE_URL}/api/storage/buckets/${bucket}/objects/${key}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${_accessToken || ANON_KEY}` },
      body: formData,
    }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export function getFileURL(bucket, key) {
  return `${BASE_URL}/api/storage/buckets/${bucket}/objects/${key}`;
}

// ── Edge Functions ────────────────────────────────────────────────────────────

export async function invokeFunction(functionName, body = {}) {
  const res = await fetch(`${BASE_URL}/api/functions/${functionName}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Function ${functionName} failed`);
  return data;
}
