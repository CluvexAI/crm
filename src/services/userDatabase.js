const STORAGE_KEY = 'zsm_crm_users';
const TOMBSTONE_KEY = 'zsm_crm_deleted_uuids'; // FIX #3–4: Persistent tombstone store
const CURRENT_VERSION = '1.0';
const API_BASE = 'http://localhost:5001/api/users';

// ─── Tombstone Helpers ────────────────────────────────────────────────────────

/** Returns the set of permanently deleted UUIDs from localStorage */
const getTombstones = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(TOMBSTONE_KEY)) || []);
  } catch {
    return new Set();
  }
};

/** Adds a UUID to the persistent tombstone set */
const writeTombstone = (uuid) => {
  try {
    const set = getTombstones();
    set.add(String(uuid));
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...set]));
    console.log('[UserDB] Tombstone written for UUID:', uuid);
  } catch (e) {
    console.error('[UserDB] Failed to write tombstone:', e);
  }
};

/** Returns true if a UUID has been permanently deleted */
const isUUIDTombstoned = (uuid) => getTombstones().has(String(uuid));

/** Filters a user array to remove any tombstoned UUIDs */
const applyTombstones = (users) => {
  const tombstones = getTombstones();
  if (tombstones.size === 0) return users;
  const before = users.length;
  const filtered = users.filter(u => !tombstones.has(String(u.uuid)));
  const removed = before - filtered.length;
  if (removed > 0) console.log(`[UserDB] Tombstone filter removed ${removed} ghost user(s) from sync data`);
  return filtered;
};

// ─── Backend Sync Helpers ─────────────────────────────────────────────────────

/** Fire-and-forget — syncs a mutation to the backend without blocking the UI */
const syncToBackend = (method, url, body) => {
  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(res => {
    // FIX #4 (frontend): If backend says tombstoned (409/410), suppress silently
    if (res.status === 409 || res.status === 410) {
      console.warn(`[UserDB] Backend rejected ${method} ${url} — tombstoned UUID, suppressing`);
    }
  }).catch(err => console.warn('[UserDB] Backend sync failed:', err.message));
};

/**
 * Fetches users from the backend on app load.
 * - If the backend already has data  → use it as the source of truth, but re-apply tombstones
 * - If the backend is empty (first run) → seed it with the current localStorage data (minus tombstoned)
 * Always returns the authoritative, tombstone-filtered user list.
 */
export const fetchAndSyncUsers = async () => {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      // FIX #3: Backend is authoritative, but tombstones are the final filter.
      // A deleted user that the backend already strips won't appear, but
      // if backend has stale data, local tombstone is the safety net.
      const safe = applyTombstones(json.data);
      setStorage(safe);
      console.log(`[UserDB] Synced ${json.data.length} users from backend (${safe.length} after tombstone filter)`);
      return safe;
    }

    // Backend DB is empty or not yet seeded — push localStorage data to it (minus tombstoned)
    const localUsers = getStorage();
    if (localUsers && localUsers.length > 0) {
      const safeLocal = applyTombstones(localUsers);
      const seedRes = await fetch(`${API_BASE}/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: safeLocal }),
      });
      const seedJson = await seedRes.json();
      if (seedJson.success) {
        console.log(`[UserDB] Seeded backend with ${safeLocal.length} users from localStorage`);
      }
      return safeLocal;
    }
  } catch (err) {
    console.warn('[UserDB] Backend unreachable — using localStorage fallback:', err.message);
  }
  // Final fallback: apply tombstones to whatever is in localStorage
  return applyTombstones(getStorage() || []);
};

const getStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return null;
  }
};

const setStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Error writing to localStorage:', e);
    return false;
  }
};

export const initializeDatabase = (defaultUsers) => {
  const stored = getStorage();
  if (stored && Array.isArray(stored) && stored.length > 0) {
    console.log('[UserDB] Loading users from localStorage');
    return stored;
  }
  console.log('[UserDB] Initializing database with default users');
  // FIX #6: Even on fresh init, apply tombstone filter so deleted seed users don't come back
  const safe = applyTombstones(defaultUsers);
  setStorage(safe);
  return safe;
};

export const getAllUsers = () => {
  const users = getStorage();
  return users || [];
};

export const getUserById = (uuid) => {
  const users = getStorage();
  return users?.find(u => u.uuid === uuid) || null;
};

export const createUserRecord = (userData) => {
  // FIX #4: Block recreation of tombstoned UUIDs at the frontend layer
  if (userData.uuid && isUUIDTombstoned(userData.uuid)) {
    console.error('[UserDB] BLOCKED: Attempt to create user with tombstoned UUID:', userData.uuid);
    throw new Error(`Cannot recreate permanently deleted user (UUID: ${userData.uuid})`);
  }
  const users = getStorage() || [];
  const newUser = {
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  users.push(newUser);
  setStorage(users);
  console.log('[UserDB] Created user:', newUser.uuid);

  // Sync to backend (non-blocking)
  syncToBackend('POST', API_BASE, newUser);

  return newUser;
};

export const updateUserRecord = (uuid, userData) => {
  // FIX #4: The primary ghost-create bug — updateUserRecord used to silently create
  // any UUID it couldn't find. Now tombstoned UUIDs are blocked entirely.
  if (isUUIDTombstoned(uuid)) {
    console.warn('[UserDB] BLOCKED: updateUserRecord called for tombstoned UUID:', uuid, '— suppressing ghost-create');
    return null;
  }

  const users = getStorage() || [];
  const index = users.findIndex(u => u.uuid === uuid);

  if (index === -1) {
    // UUID not in localStorage AND not tombstoned — this is a legitimate new user
    // (e.g., created on another device). Safe to create.
    console.warn('[UserDB] User not found, creating dynamic record for non-tombstoned UUID:', uuid);
    const newUser = {
      uuid,
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    users.push(newUser);
    setStorage(users);
    syncToBackend('PUT', `${API_BASE}/${uuid}`, newUser);
    return newUser;
  }

  const currentUser = users[index];
  const updatedUser = {
    ...currentUser,
    ...userData,
    updatedAt: new Date().toISOString(),
    version: (currentUser.version || 0) + 1
  };

  users[index] = updatedUser;
  setStorage(users);
  console.log('[UserDB] Updated user:', uuid, 'version:', updatedUser.version);

  // Sync to backend (non-blocking)
  syncToBackend('PUT', `${API_BASE}/${uuid}`, updatedUser);

  return updatedUser;
};

export const deleteUserRecord = (uuid) => {
  // FIX #2 (frontend): Write tombstone FIRST, before removing from array
  // This ensures that even if anything reads localStorage in between, the UUID is already dead.
  writeTombstone(uuid);

  const users = getStorage() || [];
  const filtered = users.filter(u => String(u.uuid) !== String(uuid));
  setStorage(filtered);
  console.log('[UserDB] Deleted and tombstoned user:', uuid);

  // Sync to backend (non-blocking — backend will also write tombstone on its side)
  syncToBackend('DELETE', `${API_BASE}/${uuid}`);

  return true;
};

export const upsertUser = (uuid, userData) => {
  if (uuid) {
    return updateUserRecord(uuid, userData);
  }
  return createUserRecord(userData);
};

export const resetDatabase = (defaultUsers) => {
  localStorage.removeItem(STORAGE_KEY);
  // NOTE: Intentionally do NOT clear tombstones on reset — deleted users must stay deleted
  const safe = applyTombstones(defaultUsers);
  setStorage(safe);
  console.log('[UserDB] Database reset (tombstones preserved)');
  return safe;
};

export const getDatabaseInfo = () => {
  const users = getStorage() || [];
  const tombstones = getTombstones();
  return {
    version: CURRENT_VERSION,
    userCount: users.length,
    tombstonedCount: tombstones.size,
    tombstones: [...tombstones],
    lastUpdated: users.length > 0
      ? users.reduce((max, u) => {
          const up = u.updatedAt || u.createdAt || '';
          return up > max ? up : max;
        }, '')
      : null
  };
};
