const STORAGE_KEY = 'zsm_crm_users';
const CURRENT_VERSION = '1.0';

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
  setStorage(defaultUsers);
  return defaultUsers;
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
  return newUser;
};

export const updateUserRecord = (uuid, userData) => {
  const users = getStorage() || [];
  const index = users.findIndex(u => u.uuid === uuid);
  
  if (index === -1) {
    console.warn('[UserDB] User not found, creating dynamic fallback record for:', uuid);
    const newUser = {
      uuid,
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    users.push(newUser);
    setStorage(users);
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
  
  return updatedUser;
};

export const deleteUserRecord = (uuid) => {
  const users = getStorage() || [];
  const filtered = users.filter(u => u.uuid !== uuid);
  setStorage(filtered);
  console.log('[UserDB] Deleted user:', uuid);
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
  setStorage(defaultUsers);
  console.log('[UserDB] Database reset');
  return defaultUsers;
};

export const getDatabaseInfo = () => {
  const users = getStorage() || [];
  return {
    version: CURRENT_VERSION,
    userCount: users.length,
    lastUpdated: users.length > 0 
      ? users.reduce((max, u) => {
          const up = u.updatedAt || u.createdAt || '';
          return up > max ? up : max;
        }, '')
      : null
  };
};
