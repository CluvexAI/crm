import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  users as initialUsers,
  leads as initialLeads,
  sales as initialSales,
  invoices as initialInvoices,
  projects as initialProjects,
  attendance as initialAttendance,
  leaveRequests as initialLeaves,
  messages as initialMessages,
  auditLogs as initialAudit,
  ROLES,
} from '../data/mockData';
import {
  can,
  canUploadImageFor,
  requirePermission,
  PermissionError,
} from '../services/rbacService';
import {
  uploadProfileImage as uploadToStorage,
  deleteProfileImage as deleteFromStorage,
} from '../services/uploadService';
import { verifyPassword, hashPassword, isPasswordHashed } from '../services/passwordService';
import {
  startMeeting as startMeetingService,
  endMeeting as endMeetingService,
  getActiveMeeting as getActiveMeetingService,
  getMeetingStats,
} from '../services/meetingService';
import {
  createInvoice,
  updateInvoice as updateInvoiceService,
  getAllInvoices,
  deleteInvoice as deleteInvoiceFromStorage
} from '../services/invoiceService';
import {
  initializeDatabase,
  getAllUsers,
  createUserRecord,
  updateUserRecord,
  fetchAndSyncUsers,
} from '../services/userDatabase';
import { cleanInsforgeBeforeCRMDelete } from '../services/insforgeDirectoryService';
import api from '../services/apiService';
import {
  initializeChatDatabase,
  initializeChatConnection,
  disconnectChat,
  registerUser as registerChatUser,
  getTotalUnreadCount as getTotalChatUnread,
  getOrCreateDirectChat as getOrCreateChat,
  ensureDepartmentChat as ensureDeptChat,
  updatePresence as updateChatPresence,
} from '../services/chatService';
import {
  initializeLeadsDatabase,
  getAllLeads,
  createLeadRecord,
  updateLeadRecord,
  bulkDeleteLeadRecords,
  addLeadRemark
} from '../services/leadDatabase';
import {
  initializeSalesDatabase,
  getAllSales as getAllSalesFromDB,
  createSaleRecord,
  updateSaleRecord,
  deleteSaleRecord
} from '../services/salesDatabase';
import {
  initializeProjectsDatabase,
  getAllProjects as getAllProjectsFromDB,
  createProjectRecord,
  updateProjectRecord,
  deleteProjectRecord
} from '../services/projectsDatabase';
import {
  initializeAttendanceDatabase,
  getAllAttendanceLogs,
  fetchAndSyncAttendance,
  upsertAttendanceLog as upsertAttendanceLogDB,
  setAllAttendanceLogs
} from '../services/attendanceDatabase';
import { runOneTimeMigration } from '../services/localStorageMigration';

const AppContext = createContext(null);

// Migration banner helpers are now in localStorageMigration.js

/** Deterministic UUID v4 generator (crypto-based when available) */
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [allLeads, setAllLeads] = useState(initialLeads);
  const [allSales, setAllSales] = useState(initialSales);
  const [allInvoices, setAllInvoices] = useState([]);
  const [allProjects, setAllProjects] = useState(initialProjects);
  const [allAttendance, setAllAttendance] = useState(initialAttendance);
  const [allLeaves, setAllLeaves] = useState(initialLeaves);
  const [allMessages, setAllMessages] = useState(initialMessages);
  const [allNotifications, setAllNotifications] = useState([]);
  const [allAuditLogs, setAllAuditLogs] = useState(initialAudit);
  const [allEmails, setAllEmails] = useState([]);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [alertModal, setAlertModal] = useState(null);

  const showAlertModal = useCallback((title, message) => {
    setAlertModal({ title, message: message || title });
  }, []);

  const hideAlertModal = useCallback(() => {
    setAlertModal(null);
  }, []);

  useEffect(() => {
    const initUsers = async () => {
      // Step 1: Sync users from backend (overwrites localStorage if backend has data)
      let dbUsers = await fetchAndSyncUsers();

      // Step 2: If sync returned nothing, fall back to localStorage
      if (!dbUsers || dbUsers.length === 0) {
        dbUsers = getAllUsers();
      }

      const rawUserStorage = localStorage.getItem('zsm_crm_users');
      if (!rawUserStorage || dbUsers.length === 0) {
        console.log('[AppContext] No users found, initializing database...');
        const hashedUsers = await Promise.all(
          initialUsers.map(async (user) => {
            const hashed = await hashPassword(user.password);
            return { ...user, password: hashed };
          })
        );
        // FIX #6: Apply tombstone filter before seeding — prevents deleted mock users
        // from reappearing when localStorage is cleared or on a new device/browser.
        initializeDatabase(hashedUsers); // initializeDatabase itself also applies tombstones
        dbUsers = getAllUsers(); // re-read to get the tombstone-filtered result
        setAllUsers(dbUsers.map(u => ({ ...u, id: u.id || u.uuid, employeeId: u.employeeId || '', status: u.status || 'Active' })));

        console.log('[AppContext] All users initialized with hashed passwords');
      } else {
        console.log('[AppContext] Loaded', dbUsers.length, 'users from database');
        
        // Self-healing of users removed: deleted users should stay deleted.        
        // Check and fix any users with unhashed passwords
        let needsUpdate = false;
        const updatedUsers = await Promise.all(
          dbUsers.map(async (user) => {
            if (!user.password || !isPasswordHashed(user.password)) {
              console.log('[AppContext] Hashing unhashed password for:', user.email);
              needsUpdate = true;
              const hashed = await hashPassword(user.password || 'password123');
              return { ...user, password: hashed };
            }
            return user;
          })
        );
        
        if (needsUpdate) {
          console.log('[AppContext] Updating users with hashed passwords...');
          updatedUsers.forEach(user => updateUserRecord(user.uuid, { password: user.password }));
          dbUsers = updatedUsers;
        }
        
        // Admin password repair removed — admin passwords now persist correctly.
        // Password changes go through PUT /api/users/:uuid/password (backend source of truth).
        
        setAllUsers(dbUsers.filter(u => u.status !== 'Deleted').map(u => ({
          ...u,
          id: u.id || u.uuid,
          employeeId: u.employeeId || '',
          status: u.status || 'Active',
        })));

      }

      // Initialize chat system and auto-register all users
      initializeChatDatabase();
      dbUsers.forEach(u => registerChatUser({ ...u, id: u.id || u.uuid }));

      // Ensure department chats exist for all departments
      const depts = [...new Set(dbUsers.map(u => u.department).filter(Boolean))];
      depts.forEach(dept => ensureDeptChat(dept, dbUsers));

      // ── ONE-TIME MIGRATION: localStorage → InsForge central DB ────────────
      // Runs once per browser (guarded by MIGRATION_FLAG in localStorage).
      // Handles leads, converted sales, and the offline queue.
      // User ID is passed so migrated records are attributed to the correct agent.
      const currentUserId = dbUsers.find(
        u => u.email?.toLowerCase() === localStorage.getItem('zsm_crm_current_user_email')
      )?.id || null;

      try {
        await runOneTimeMigration(currentUserId);
      } catch (migrationErr) {
        console.warn('[AppContext] One-time migration encountered an error:', migrationErr.message);
      }

      // ── Load leads from central InsForge DB ──────────────────────────────
      let dbLeads = [];
      try {
        console.log('[AppContext] Loading leads from central database...');
        dbLeads = await api.leads.getAll();
        console.log('[AppContext] Central database returned', dbLeads?.length || 0, 'leads');
      } catch (e) {
        console.error('[AppContext] Central leads load failed, falling back to local storage:', e);
        dbLeads = getAllLeads();
      }

      // Merge unmigrated local leads so they are never lost from the UI
      let localLeads = getAllLeads();
      
      // Cleanup: Remove local leads that are known duplicates of DB leads to fix stuck UI entries
      if (dbLeads.length > 0 && localLeads.length > 0) {
        const cleanedLocal = localLeads.filter(local => {
          // If it matches a DB lead by ID, it's migrated
          if (dbLeads.some(db => String(db.id) === String(local.id))) return false;
          
          // Check if it's a duplicate of a DB lead (phone match)
          if (local.ownerPhone) {
            const p1 = String(local.ownerPhone).replace(/\D/g, '');
            if (p1.length >= 7) {
              const isDup = dbLeads.some(db => {
                if (!db.ownerPhone) return false;
                const p2 = String(db.ownerPhone).replace(/\D/g, '');
                if (p1 === p2) return true;
                if (p2.length >= 7) {
                  const p1Trim = p1.replace(/^0+/, '');
                  const p2Trim = p2.replace(/^0+/, '');
                  return p1.includes(p2Trim) || p2.includes(p1Trim);
                }
                return false;
              });
              if (isDup) {
                console.log(`[AppContext] Scrubbing stuck local duplicate: ${local.ownerPhone}`);
                return false; // Remove from local storage
              }
            }
          }
          return true;
        });
        
        // Next, clean up local-to-local duplicates
        const uniqueLocal = [];
        for (const local of cleanedLocal) {
          let isDup = false;
          if (local.ownerPhone) {
            const p1 = String(local.ownerPhone).replace(/\D/g, '');
            if (p1.length >= 7) {
              isDup = uniqueLocal.some(u => {
                if (!u.ownerPhone) return false;
                const p2 = String(u.ownerPhone).replace(/\D/g, '');
                if (p1 === p2) return true;
                if (p2.length >= 7) {
                  const p1Trim = p1.replace(/^0+/, '');
                  const p2Trim = p2.replace(/^0+/, '');
                  return p1.includes(p2Trim) || p2.includes(p1Trim);
                }
                return false;
              });
            }
          }
          if (!isDup) uniqueLocal.push(local);
          else console.log(`[AppContext] Scrubbing local-to-local duplicate: ${local.ownerPhone}`);
        }

        if (uniqueLocal.length !== localLeads.length) {
          console.log(`[AppContext] Cleaned up ${localLeads.length - uniqueLocal.length} stuck local duplicates.`);
          localStorage.setItem('zsm_crm_leads', JSON.stringify(uniqueLocal));
          localLeads = uniqueLocal;
        }
      }

      const unmigratedLeads = localLeads.filter(
        local => !dbLeads.some(db => String(db.id) === String(local.id))
      );
      if (unmigratedLeads.length > 0) {
        console.log('[AppContext] Merging', unmigratedLeads.length, 'unmigrated leads from local cache to state');
        dbLeads = [...dbLeads, ...unmigratedLeads];
      }

      // Seed with mock data only if central DB returned nothing and no local data exists
      if (dbLeads.length === 0 && !localStorage.getItem('zsm_crm_leads')) {
        initializeLeadsDatabase(initialLeads);
        dbLeads = initialLeads;
        try {
          for (const l of initialLeads) {
            await api.leads.create(l).catch(() => null);
          }
        } catch (err) {
          console.warn('[AppContext] Failed to seed central leads:', err);
        }
      }
      setAllLeads(dbLeads);

      // ── Load sales from central InsForge DB ──────────────────────────────
      let dbSales = [];
      try {
        console.log('[AppContext] Loading sales from central database...');
        dbSales = await api.sales.getAll();
        console.log('[AppContext] Central database returned', dbSales?.length || 0, 'sales');
      } catch (e) {
        console.error('[AppContext] Central sales load failed, falling back to local storage:', e);
        dbSales = getAllSalesFromDB();
      }

      // Merge unmigrated local sales so they are never lost from the UI
      const localSales = getAllSalesFromDB();
      const unmigratedSales = localSales.filter(
        local => !dbSales.some(db => String(db.id) === String(local.id))
      );
      if (unmigratedSales.length > 0) {
        console.log('[AppContext] Merging', unmigratedSales.length, 'unmigrated sales from local cache to state');
        dbSales = [...dbSales, ...unmigratedSales];
      }

      // Seed with mock data only if central DB returned nothing and no local data exists
      if (dbSales.length === 0 && !localStorage.getItem('zsm_crm_sales')) {
        initializeSalesDatabase(initialSales);
        dbSales = initialSales;
        try {
          for (const s of initialSales) {
            await api.sales.create(s).catch(() => null);
          }
        } catch (err) {
          console.warn('[AppContext] Failed to seed central sales:', err);
        }
      }
      setAllSales(dbSales);
 
      // ── Load invoices from central InsForge DB ───────────────────────────
      let dbInvoices = [];
      try {
        console.log('[AppContext] Loading invoices from central database...');
        dbInvoices = await api.invoices.getAll();
        console.log('[AppContext] Central database returned', dbInvoices?.length || 0, 'invoices');
      } catch (e) {
        console.error('[AppContext] Central invoices load failed, falling back to local storage:', e);
        dbInvoices = getAllInvoices();
      }

      // Merge unmigrated local invoices so they are never lost from the UI
      const localInvoices = getAllInvoices();
      const unmigratedInvoices = localInvoices.filter(
        local => !dbInvoices.some(db => String(db.id) === String(local.id))
      );
      if (unmigratedInvoices.length > 0) {
        console.log('[AppContext] Merging', unmigratedInvoices.length, 'unmigrated invoices from local cache to state');
        dbInvoices = [...dbInvoices, ...unmigratedInvoices];
      }

      // Seed with mock data only if central DB returned nothing and no local data exists
      if (dbInvoices.length === 0 && !localStorage.getItem('zsm_invoices')) {
        dbInvoices = initialInvoices;
        try {
          for (const inv of initialInvoices) {
            await api.invoices.create(inv).catch(() => null);
          }
        } catch (err) {
          console.warn('[AppContext] Failed to seed central invoices:', err);
        }
      }
      setAllInvoices(dbInvoices);

      // Initialize projects from database
      let dbProjects = getAllProjectsFromDB();
      const rawProjectsStorage = localStorage.getItem('zsm_crm_projects');
      if (!rawProjectsStorage) {
        initializeProjectsDatabase(initialProjects);
        dbProjects = initialProjects;
      } else {
        console.log('[AppContext] Loaded', dbProjects.length, 'projects from database');
      }
      setAllProjects(dbProjects);

      // ── Load attendance from Insforge DB (primary source of truth) ──────────
      console.log('[AppContext] Loading attendance logs from Insforge...');
      let dbAttendance = [];
      try {
        dbAttendance = await fetchAndSyncAttendance();
        console.log('[AppContext] Attendance loaded:', dbAttendance.length, 'logs (Insforge + local merged)');
      } catch (e) {
        console.error('[AppContext] fetchAndSyncAttendance failed, using local cache:', e);
        dbAttendance = getAllAttendanceLogs();
      }

      // Seed with mock data only if no data exists anywhere
      if (!dbAttendance || dbAttendance.length === 0) {
        initializeAttendanceDatabase(initialAttendance);
        dbAttendance = initialAttendance;
      }
      setAllAttendance(dbAttendance);

      // ── Restore User Session ────────────────────────────────────────────────
      const currentEmail = localStorage.getItem('zsm_crm_current_user_email');
      if (currentEmail) {
        const restoredUser = dbUsers.find(u => u.email?.toLowerCase() === currentEmail.toLowerCase());
        if (restoredUser) {
          console.log('[AppContext] Restoring session for:', restoredUser.email);
          setCurrentUser({ ...restoredUser, password: '********' });
          const storedSessionStart = localStorage.getItem('zsm_crm_session_start');
          setSessionStart(storedSessionStart ? new Date(storedSessionStart) : new Date());
          // Initialize WebSocket chat connection
          initializeChatConnection(restoredUser.id || restoredUser.uuid, restoredUser.name).catch(err => console.warn('[Chat] WS init failed on reload:', err.message));
        }
      }

      setIsInitialized(true);
    };
    if (!isInitialized) {
      initUsers();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const addAuditLog = (action, userName, details) => {
    try {
      const log = {
        id: Date.now(),
        action,
        user: userName,
        timestamp: new Date().toISOString(),
        details,
      };
      setAllAuditLogs((prev) => [log, ...prev]);
    } catch (e) {
      console.warn('Audit log failed:', e.message);
    }
  };

  const addNotification = (userId, title, message, type, referenceId) => {
    try {
      const notification = {
        id: Date.now() + Math.random(),
        userId,
        title,
        message,
        type,
        referenceId,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setAllNotifications((prev) => [notification, ...prev]);
      return notification;
    } catch (e) {
      console.warn('Notification failed:', e.message);
    }
  };

  const markNotificationRead = (notificationId) => {
    setAllNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  };

  const getNotificationsByUser = (userId) => {
    return allNotifications.filter((n) => n.userId === userId);
  };

  const getUnreadNotificationsCount = (userId) => {
    return allNotifications.filter((n) => n.userId === userId && !n.isRead).length;
  };

  // ─── Authentication ───────────────────────────────────────────────────────

  const login = async (email, password) => {
    console.log('[LOGIN] ===== START =====');
    
    // ─── Get users from state OR localStorage ────────────────────────────
    let users = allUsers;
    
    // If state is empty, try localStorage
    if (!users || users.length === 0) {
      console.log('[LOGIN] State empty, checking localStorage...');
      users = getAllUsers();
      
      // If still empty, use initial mock data
      if (!users || users.length === 0) {
        console.log('[LOGIN] Creating fresh users with hashed passwords');
        users = await Promise.all(
          initialUsers.map(async (u) => ({
            ...u,
            password: await hashPassword(u.password)
          }))
        );
        initializeDatabase(users);
        setAllUsers(users);
      } else {
        console.log('[LOGIN] Loaded from localStorage:', users.length);
        setAllUsers(users);
      }
    }
    
    console.log('[LOGIN] Users available:', users?.map(u => u.email));
    
    // ─── Input Validation ─────────────────────────────────────────────
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    console.log('[LOGIN] Login attempt:', trimmedEmail);

    // ─── Find User by Email ──────────────────────────────────────────
    let user = users.find((u) => u.email?.toLowerCase() === trimmedEmail);
    
    if (!user) {
      console.log('[LOGIN] User not found:', trimmedEmail);
      return { success: false, error: 'Invalid credentials' };
    }

    console.log('[LOGIN] ✓ User found:', user.name, user.role);

    // ─── Password verification ─────────────────────────────────────
    let isValidPassword = false;
    let mustChangePassword = false;

    try {
      if (isPasswordHashed(user.password)) {
        const { verifyPasswordOnServer } = await import('../services/passwordSyncService');
        try {
          const res = await verifyPasswordOnServer(user.uuid, trimmedPassword);
          isValidPassword = res.valid;
          mustChangePassword = res.must_change_password;
        } catch (serverErr) {
          console.warn('[LOGIN] Server verification failed, falling back to local', serverErr);
          isValidPassword = await verifyPassword(trimmedPassword, user.password);
          mustChangePassword = user.must_change_password;
        }
      } else if (user.password === trimmedPassword) {
        isValidPassword = true;
        // Migrate to bcrypt
        const newHash = await hashPassword(trimmedPassword);
        updateUserRecord(user.uuid, { password: newHash });
        setAllUsers(prev => prev.map(u => u.uuid === user.uuid ? { ...u, password: newHash } : u));
      }
    } catch (err) {
      console.error('[LOGIN] Password error:', err.message);
    }

    if (isValidPassword) {
      const sessionUser = { ...user, password: '********' };
      setCurrentUser(sessionUser);
      if (mustChangePassword) {
        setForcePasswordChange(true);
      }
      const newSessionStart = new Date();
      setSessionStart(newSessionStart);
      localStorage.setItem('zsm_crm_session_start', newSessionStart.toISOString());
      localStorage.setItem('zsm_crm_current_user_email', user.email?.toLowerCase() || '');
      registerChatUser(user);
      // Initialize WebSocket chat connection
      initializeChatConnection(user.id, user.name).catch(err => console.warn('[Chat] WS init failed:', err.message));
      addAuditLog('User Login', user.name, `Login successful`);
      // Run migration with correct authenticated user ID
      runOneTimeMigration(user.id).catch(() => {});
      return { success: true, user: sessionUser };
    }

    console.log('[LOGIN] ✗ Invalid credentials');
    return { success: false, error: 'Invalid credentials' };
  };

  const logout = () => {
    if (currentUser) addAuditLog('User Logout', currentUser.name, 'User logged out');
    disconnectChat();
    localStorage.removeItem('zsm_crm_current_user_email');
    localStorage.removeItem('zsm_crm_session_start');
    setCurrentUser(null);
    setSessionStart(null);
    setForcePasswordChange(false);
    setActivePage('dashboard');
  };

  // ─── User Management ─────────────────────────────────────────────────────

  /**
   * Create a new employee.
   * UUID is generated here and is NEVER exposed as editable afterwards.
   * employeeId is auto-assigned but Admin can change it later.
   */
  const createUser = async (userData) => {
    requirePermission(currentUser, 'EDIT_EMPLOYEE_PROFILE');

    // 🔐 RBAC: HR CANNOT create Admin users
    if (currentUser.role === ROLES.HR && userData.role === ROLES.ADMIN) {
      throw new Error("HR cannot create Admin users.");
    }
    const existingEmpId = allUsers.find(
      (u) => u.employeeId === userData.employeeId
    );
    if (existingEmpId) throw new Error(`Employee ID "${userData.employeeId}" already exists.`);

    // Hash password before storing
    let userDataWithHashedPassword = { ...userData };
    if (userDataWithHashedPassword.password && !isPasswordHashed(userDataWithHashedPassword.password)) {
      userDataWithHashedPassword.password = await hashPassword(userDataWithHashedPassword.password);
      console.log('[CreateUser] Hashed password for new user');
    }

    const newUser = {
      ...userDataWithHashedPassword,
      uuid: generateUUID(),
      id: Date.now(),
      employeeId: userData.employeeId || `EMP-${String(allUsers.length + 1).padStart(3, '0')}`,
      status: 'Active',
      profileImageUrl: null,
      profileImageSize: null,
      profileImageType: null,
      profileImageName: null,
      profileImageUploadedAt: null,
    };
    
    // Persist to database
    const savedUser = createUserRecord(newUser);
    
    // 📧 Auto-Provision Email Account (Provisioning Workflow)
    if (userData.mailConfig && userData.mailConfig.password) {
      const { addUserEmail } = require('../services/emailService');
      addUserEmail(
        savedUser.uuid, 
        savedUser.name, 
        savedUser.role, 
        savedUser.email, 
        userData.mailConfig.password,
        {
          imapHost: userData.mailConfig.imapHost,
          imapPort: userData.mailConfig.imapPort,
          smtpHost: userData.mailConfig.smtpHost,
          smtpPort: userData.mailConfig.smtpPort
        }
      );
    }
    
    // Update React state
    setAllUsers((prev) => [...prev, savedUser]);
    registerChatUser(savedUser);
    // Refresh department chat membership for new user's department
    if (savedUser.department) {
      const updatedUsers = [...allUsers, savedUser];
      ensureDeptChat(savedUser.department, updatedUsers);
    }
    addAuditLog('User Created', currentUser.name, `Created: ${userData.name} (${savedUser.employeeId}) [UUID: ${savedUser.uuid}]`);
    return savedUser;
  };

  /**
   * Update general employee profile fields.
   * uuid and id fields are stripped so they can never be overwritten.
   */
   const updateUser = async (uuid, userData) => {
     const targetUser = allUsers.find(u => u.uuid === uuid);
     if (!targetUser) throw new Error("User not found");

    // 🔐 RBAC: HR CANNOT modify Admin users
    if (currentUser.role === ROLES.HR && targetUser.role === ROLES.ADMIN) {
      throw new Error("HR cannot modify Admin users");
    }

    // 🔐 RBAC: HR CANNOT assign Admin role
    if (currentUser.role === ROLES.HR && userData.role && userData.role === ROLES.ADMIN) {
      throw new Error("HR cannot assign Admin role");
    }

    // 🔐 RBAC: Field Whitelisting for HR
    let dataToApply = { ...userData };
    if (currentUser.role === ROLES.HR) {
      const allowedFields = ['name', 'email', 'phone', 'address', 'emergencyContact', 'designation', 'experience', 'aadhaar', 'voterId', 'department', 'status', 'password'];
      dataToApply = Object.keys(userData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = userData[key];
          return obj;
        }, {});
    }

     // 🔐 Hash password if being updated
     let processedData = { ...dataToApply };
     if (processedData.password) {
       if (!isPasswordHashed(processedData.password)) {
         processedData.password = await hashPassword(processedData.password);
       }
     }

    // Normalize email to lowercase
    if (processedData.email) {
      processedData.email = processedData.email.toLowerCase().trim();
    }

    // eslint-disable-next-line no-unused-vars
    const { uuid: _u, id: _i, ...safeData } = processedData;
    
    // Persist to database FIRST, then update UI
    const updatedUser = updateUserRecord(uuid, safeData);
    
    // Update React state with data from database
    setAllUsers((prev) =>
      prev.map((u) => (u.uuid === uuid ? { ...u, ...updatedUser } : u))
    );
    
    addAuditLog('User Updated', currentUser.name, `Updated employee UUID: ${uuid}`);
    
    // Keep currentUser in sync if user updated themselves
    if (currentUser && currentUser.uuid === uuid) {
      setCurrentUser((prev) => ({ ...prev, ...updatedUser }));
    }
    
    return updatedUser;
  };

  /**
   * Update Employee ID (business identifier).
   * RBAC: Admin only.
   * Validates uniqueness across all employees.
   *
   * @param {string} targetUuid  - immutable UUID of the target employee
   * @param {string} newEmpId    - new business identifier
   */
  const updateEmployeeId = (targetUuid, newEmpId) => {
    requirePermission(currentUser, 'EDIT_EMPLOYEE_ID');

    const trimmed = newEmpId.trim().toUpperCase();
    if (!trimmed) throw new Error('Employee ID cannot be empty.');

    const conflict = allUsers.find(
      (u) => u.employeeId === trimmed && u.uuid !== targetUuid
    );
    if (conflict) {
      throw new Error(`Employee ID "${trimmed}" is already assigned to ${conflict.name}.`);
    }

    // Persist to database (ignore return, just ensure DB write)
    updateUserRecord(targetUuid, { employeeId: trimmed });
    
    // Update React state
    setAllUsers((prev) =>
      prev.map((u) => (u.uuid === targetUuid ? { ...u, employeeId: trimmed } : u))
    );

    const target = allUsers.find((u) => u.uuid === targetUuid);
    addAuditLog(
      'Employee ID Changed',
      currentUser.name,
      `Changed Employee ID of ${target?.name} from "${target?.employeeId}" to "${trimmed}"`
    );
  };

  /**
   * Upload / replace profile image.
   * RBAC:
   *   - Admin can upload for ANY employee.
   *   - Any employee can update ONLY their own image.
   *   - HR cannot upload (view only).
   *
   * @param {string} targetUuid - UUID of the employee whose image is being set
   * @param {File}   file       - the selected image File object
   * @returns {Promise<{ success: boolean, imageData: object }>}
   */
  const uploadEmployeeProfileImage = async (targetUuid, file) => {
    if (!canUploadImageFor(currentUser, targetUuid)) {
      throw new PermissionError(
        `Role "${currentUser.role}" is not permitted to upload a profile image for this employee.`
      );
    }

    // Revoke the old blob URL to free memory (mirrors S3 "replace not duplicate")
    const existingUser = allUsers.find((u) => u.uuid === targetUuid);
    if (existingUser?.profileImageUrl) {
      await deleteFromStorage(existingUser.profileImageUrl);
    }

    // Delegate validation + storage to the upload service (mimics backend API)
    const imageData = await uploadToStorage(file, targetUuid);

    const imageUpdate = {
      profileImageUrl: imageData.url,
      profileImageSize: imageData.size,
      profileImageType: imageData.type,
      profileImageName: imageData.name,
      profileImageUploadedAt: imageData.uploadedAt,
    };

    // Persist to database
    const updatedUser = updateUserRecord(targetUuid, imageUpdate);

    // Update React state
    setAllUsers((prev) =>
      prev.map((u) =>
        u.uuid === targetUuid
          ? { ...u, ...updatedUser }
          : u
      )
    );

    // Keep currentUser in sync if uploading own image
    if (currentUser && currentUser.uuid === targetUuid) {
      setCurrentUser((prev) => ({ ...prev, ...updatedUser }));
    }

    addAuditLog(
      'Profile Image Uploaded',
      currentUser.name,
      `Image set for ${existingUser?.name} (${existingUser?.employeeId}) — ${(imageData.size / 1024).toFixed(1)} KB, ${imageData.type}`
    );

    return { success: true, imageData };
  };

  /**
   * Delete / remove a profile image.
   * RBAC: Admin only.
   */
  const deleteEmployeeProfileImage = async (targetUuid) => {
    requirePermission(currentUser, 'DELETE_PROFILE_IMAGE');

    const target = allUsers.find((u) => u.uuid === targetUuid);
    if (target?.profileImageUrl) {
      await deleteFromStorage(target.profileImageUrl);
    }

    const imageDelete = {
      profileImageUrl: null,
      profileImageSize: null,
      profileImageType: null,
      profileImageName: null,
      profileImageUploadedAt: null,
    };

    // Persist to database
    const updatedUser = updateUserRecord(targetUuid, imageDelete);

    // Update React state
    setAllUsers((prev) =>
      prev.map((u) =>
        u.uuid === targetUuid
          ? { ...u, ...updatedUser }
          : u
      )
    );

    if (currentUser?.uuid === targetUuid) {
      setCurrentUser((prev) => ({ ...prev, ...updatedUser }));
    }

    addAuditLog('Profile Image Deleted', currentUser.name, `Image removed for ${target?.name} (${target?.employeeId})`);
  };

  const deleteUser = async (uuid) => {
    requirePermission(currentUser, 'DELETE_EMPLOYEE');
    const target = allUsers.find((u) => String(u.uuid) === String(uuid));

    if (target?.email === 'admin@zsmeservices.com') {
      throw new Error('The primary admin user cannot be deleted.');
    }
    if (!target) {
      throw new Error(`User not found: ${uuid}`);
    }

    // Always clean Insforge Directory BEFORE CRM Deletion (FIX #3)
    // cleanInsforgeBeforeCRMDelete cleans directory settings and then calls hardDeleteUser.
    const result = await cleanInsforgeBeforeCRMDelete(uuid, currentUser);

    if (result.success) {
      // Update React state — tombstone already committed before this point
      setAllUsers((prev) => prev.filter((u) => String(u.uuid) !== String(uuid)));

      // Remove from chat presence
      updateChatPresence(target.id, 'deactivated');

      // hardDeleteUser() writes its own detailed audit entry;
      // also add a brief CRM-level audit log entry for the admin log UI
      addAuditLog(
        'User Hard Deleted',
        currentUser.name,
        `Permanently deleted: ${target.name} (${target.employeeId}) [UUID: ${uuid}] | Audit: ${result.auditId}`
      );
    }

    return result;
  };

  // ─── Lead Management ──────────────────────────────────────────────────────

  const createLead = async (leadData) => {
    const newLead = {
      ...leadData,
      id: generateUUID(),
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      lastFollowUp: new Date().toISOString(),
      remarks: [],
    };
    let savedLead = newLead;
    try {
      // api.leads.create ALWAYS runs the duplicate check before inserting
      savedLead = await api.leads.create(newLead);
      createLeadRecord(savedLead);
    } catch (err) {
      // CASE 1: Duplicate Lead — ALWAYS re-throw, never save locally
      if (err.message && err.message.includes('DUPLICATE_LEAD')) {
        let dupData = {};
        try { dupData = JSON.parse(err.message.replace('DUPLICATE_LEAD:', '')); } catch (_) {}
        const msg = dupData.message ||
          `Lead already exists and is under active follow-up by another Sales Agent User within the last 30 days.`;
        showAlertModal('⚠️ Duplicate Lead Blocked', msg);
        throw err; // propagate so the form stays open
      }
      // CASE 2: Duplicate check itself failed (network/error) — also block
      if (err.message && err.message.includes('Duplicate check could not be completed')) {
        showAlertModal('⚠️ Error', 'Cannot verify duplicate status. Lead not saved. Please retry.');
        throw err;
      }
      // CASE 3: Other cloud error (e.g. network down) — run local duplicate check before saving locally
      console.error('[AppContext] Cloud save failed, checking local before fallback:', err);
      const allLocal = getAllLeads();
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const normPhone = (p) => {
        if (!p) return null;
        let d = String(p).replace(/\D/g, '');
        if (d.startsWith('3530')) d = '353' + d.substring(4);
        else if (d.startsWith('440')) d = '44' + d.substring(3);
        else if (d.startsWith('610')) d = '61' + d.substring(3);
        d = d.replace(/^0+/, '');
        return d.length >= 7 ? d : null;
      };
      const pNorm = normPhone(newLead.ownerPhone);
      const eNorm = newLead.email ? String(newLead.email).trim().toLowerCase() : null;

      const localDup = allLocal.find(l => {
        if (l.deletedAt || l.deleted_at) return false;
        if (l.status === 'Closed (Lost)') return false;
        const lastActivity = new Date(l.lastFollowUp || l.createdAt);
        if (lastActivity < cutoff) return false;
        if (pNorm) {
          const lNorm = normPhone(l.ownerPhone);
          if (lNorm && (lNorm === pNorm || lNorm.includes(pNorm) || pNorm.includes(lNorm))) return true;
        }
        if (eNorm && l.email && String(l.email).trim().toLowerCase() === eNorm) return true;
        return false;
      });

      if (localDup) {
        const daysSince = Math.floor((Date.now() - new Date(localDup.lastFollowUp || localDup.createdAt).getTime()) / 86400000);
        showAlertModal('⚠️ Duplicate Lead Blocked',
          `Lead already exists and is under active follow-up by another Sales Agent User within the last 30 days.\nLast activity: ${daysSince} day(s) ago.`
        );
        throw new Error('DUPLICATE_LEAD_LOCAL');
      }

      // Safe to save locally — no duplicate found anywhere
      savedLead = createLeadRecord(newLead);
    }
    // Update React state
    setAllLeads((prev) => [...prev, savedLead]);
    addAuditLog('Lead Created', currentUser.name, `${leadData.contactName} (${leadData.businessName})`);
    return savedLead;
  };

  const updateLead = async (id, leadData) => {
    const lead = allLeads.find(l => String(l.id) === String(id));
    if (!isAdmin && String(lead?.createdBy) !== String(currentUser?.id) && String(lead?.assignedTo) !== String(currentUser?.id)) {
      throw new Error('You can only update your own or assigned leads');
    }
    const dataToSave = { ...leadData, lastFollowUp: new Date().toISOString() };
    let updatedLead = { ...lead, ...dataToSave };
    try {
      updatedLead = await api.leads.update(id, dataToSave);
      updateLeadRecord(id, updatedLead);
    } catch (err) {
      // If it's a duplicate detection error from the DB trigger, propagate it
      // so the user is informed instead of silently falling back to localStorage
      if (err.message && (err.message.includes('DUPLICATE_LEAD') || err.message.includes('duplicate'))) {
        throw err;
      }
      console.error('[AppContext] Failed to update lead centrally, updating locally:', err);
      updatedLead = updateLeadRecord(id, dataToSave);
    }
    // Update React state
    setAllLeads((prev) =>
      prev.map((l) => (String(l.id) === String(id) ? { ...l, ...updatedLead } : l))
    );
    addAuditLog('Lead Updated', currentUser.name, `Lead ID: ${id}`);
    return updatedLead;
  };

  const bulkDeleteLeads = async (ids) => {
    const strIds = ids.map(id => String(id));

    // RBAC: non-admins can only delete their own or assigned leads
    if (!isAdmin) {
      strIds.forEach(id => {
        const lead = allLeads.find(l => String(l.id) === id);
        if (lead && String(lead.createdBy) !== String(currentUser?.id) && String(lead.assignedTo) !== String(currentUser?.id)) {
          throw new Error('You can only delete your own or assigned leads');
        }
      });
    }

    // Delete from InsForge DB (per-lead, errors isolated)
    let dbDeleteFailed = 0;
    for (const id of ids) {
      try {
        await api.leads.delete(id);
      } catch (err) {
        dbDeleteFailed++;
        console.error('[AppContext] Central lead delete failed for:', id, err?.message || err);
      }
    }

    if (dbDeleteFailed > 0) {
      console.warn(`[AppContext] ${dbDeleteFailed}/${ids.length} lead(s) failed to delete from central DB. Removed from local view.`);
    }

    // Also remove from local fallback store (no-op if not present)
    bulkDeleteLeadRecords(ids);

    // Always update React state (optimistic — remove from UI regardless)
    setAllLeads(prev => prev.filter(l => !strIds.includes(String(l.id))));

    addAuditLog('Leads Deleted', currentUser.name, `Deleted ${ids.length} lead(s)`);
  };

  const addRemark = async (leadId, text) => {
    // Persist to local database
    const updatedLead = addLeadRemark(leadId, text, currentUser.name);
    try {
      await api.leads.addFollowupLog(leadId, currentUser.id, text);
      await api.leads.update(leadId, { remarks: updatedLead.remarks, lastFollowUp: updatedLead.lastFollowUp });
    } catch (err) {
      console.error('[AppContext] Central lead remark update failed:', err);
    }
    // Update React state
    setAllLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, ...updatedLead }
          : l
      )
    );
  };

  const checkPhoneDuplicate = (phone, excludeId = null, altPhone = null) => {
    if (!phone && !altPhone) return { isDuplicate: false };

    const existing = allLeads.find((l) => {
      if (l.id === excludeId) return false;
      if (!l.ownerPhone && !l.altPhone) return false;

      const primaryMatch = l.ownerPhone && (
        l.ownerPhone === phone ||
        l.ownerPhone.endsWith(phone) ||
        phone.endsWith(l.ownerPhone)
      );

      const altMatch = l.altPhone && (
        l.altPhone === altPhone ||
        l.altPhone === phone ||
        l.ownerPhone === altPhone
      );

      return primaryMatch || altMatch;
    });

    if (!existing) return { isDuplicate: false };
    const daysSince = Math.floor((new Date() - new Date(existing.lastFollowUp)) / 86400000);
    if (daysSince < 30) return { isDuplicate: true, blocked: true, daysSince };
    return { isDuplicate: true, blocked: false, daysSince };
  };

  // ─── Sales ────────────────────────────────────────────────────────────────

  const createSale = async (saleData) => {
    const newSale = { 
      ...saleData, 
      id: generateUUID(), 
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
      installmentPlan: saleData.installmentPlan || [],
    };
    let savedSale = newSale;
    try {
      savedSale = await api.sales.create(newSale);
      createSaleRecord(savedSale);
    } catch (err) {
      console.error('[AppContext] Central sale creation failed, saving locally:', err);
      savedSale = createSaleRecord(newSale);
    }
    // Update React state
    setAllSales((prev) => [...prev, savedSale]);

    // Create associated invoice
    createInvoice(savedSale);
    setAllInvoices(getAllInvoices());

    // Create associated project
    createProject({
      saleId: savedSale.id,
      leadId: savedSale.leadId,
      projectName: `${saleData.businessName} - ${saleData.proposalType}`,
      clientName: saleData.businessName,
      assignedTo: null,
      assignedToName: 'Unassigned',
      assignedSalesAgent: currentUser.id,
      status: 'Planning',
      startDate: new Date().toISOString().split('T')[0],
      reports: [],
      wpUrl: '', wpUsername: '', wpPassword: '',
      domainRegistrar: '', domainUsername: '', domainPassword: '', domainProvider: '',
      cpanelUser: '', cpanelPass: '', cpanelUsername: '', cpanelPassword: '',
      facebookPage: '', gmailAcc: '', gmailId: '', gmailPassword: '',
    });

    addAuditLog('Sale Created', currentUser.name, `${saleData.proposalType} — €${saleData.amount}`);
    return savedSale;
  };

  const updateSale = async (id, saleData) => {
    try {
      const oldSale = allSales.find(s => String(s.id) === String(id)) || {};
      let updatedSale = { ...oldSale, ...saleData };
      try {
        updatedSale = await api.sales.update(id, saleData);
        updateSaleRecord(id, updatedSale);
      } catch (err) {
        console.error('[AppContext] Central sale update failed, saving locally:', err);
        updatedSale = updateSaleRecord(id, saleData);
      }
      
      // Compute diff for detailed audit log
      let changes = [];
      Object.keys(saleData).forEach(key => {
        if (key !== 'version' && key !== 'updatedAt' && oldSale[key] !== updatedSale[key]) {
          let oldVal = typeof oldSale[key] === 'object' ? JSON.stringify(oldSale[key]) : oldSale[key];
          let newVal = typeof updatedSale[key] === 'object' ? JSON.stringify(updatedSale[key]) : updatedSale[key];
          changes.push(`${key}: '${oldVal}' -> '${newVal}'`);
        }
      });
      const diffString = changes.length > 0 ? ` Changes: ${changes.join(' | ')}` : '';

      setAllSales(prev => {
        const exists = prev.some(s => String(s.id) === String(id));
        if (!exists) {
          return [...prev, updatedSale];
        }
        return prev.map(s => String(s.id) === String(id) ? { ...s, ...updatedSale } : s);
      });
      addAuditLog('Customer Updated', currentUser?.name || 'System', `Customer ID: ${id}.${diffString}`);
      return updatedSale;
    } catch (error) {
      if (error.message && error.message.includes('CONFLICT')) {
         showAlertModal('Conflict', error.message);
      }
      console.error('Failed to update sale/customer record:', error);
      return null;
    }
  };

  /**
   * Delete a customer (sale record) - Admin only
   * Permanently removes customer and handles related invoices
   */
  const deleteCustomer = (saleId) => {
    if (!isAdmin) {
      throw new Error('Only admins can delete customers');
    }
    
    const sale = allSales.find(s => String(s.id) === String(saleId));
    if (!sale) {
      throw new Error('Customer not found');
    }

    // Get related invoices
    const relatedInvoices = allInvoices.filter(inv => String(inv.saleId) === String(saleId));
    const invoiceIds = relatedInvoices.map(inv => inv.id);

    // Delete from database - cascade to invoices handled in invoiceService
    deleteSaleRecord(saleId);

    // Delete related invoices from storage
    invoiceIds.forEach(invId => {
      try {
        deleteInvoiceFromStorage(invId);
      } catch (e) {
        console.warn('Failed to delete invoice:', invId, e.message);
      }
    });

    // Update React state - remove sale and related invoices
    setAllSales(prev => prev.filter(s => String(s.id) !== String(saleId)));
    setAllInvoices(getAllInvoices());

    addAuditLog(
      'Customer Deleted',
      currentUser.name,
      `Deleted: ${sale.businessName} (${sale.contactName}) - Sale ID: ${saleId} - ${invoiceIds.length} invoice(s) affected`
    );

    return { success: true, deletedSaleId: saleId, deletedInvoiceCount: invoiceIds.length };
  };

  const deleteProject = (id) => {
    if (currentUser?.role !== ROLES.ADMIN) {
      throw new Error('Only admins can delete projects');
    }
    const project = allProjects.find(p => String(p.id) === String(id));

    // Persist to frontend database
    deleteProjectRecord(id, true);

    // Sync to backend database
    fetch('/api/projects/' + id, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name, role: currentUser.role }),
    }).catch(err => console.warn('[deleteProject] Backend sync failed:', err.message));

    // Update React state instantly
    setAllProjects((prev) => prev.filter((p) => String(p.id) !== String(id)));
    addAuditLog('Project Deleted', currentUser.name, `Project: ${project?.projectName || 'Unknown'} [ID: ${id}]`);
    return { success: true };
  };

  // ─── Projects ─────────────────────────────────────────────────────────────

  const createProject = (projectData) => {
    const newProject = createProjectRecord(projectData);
    setAllProjects((prev) => [...prev, newProject]);
    addAuditLog('Project Created', currentUser.name, `Project ID: ${newProject.id}`);
    return newProject;
  };

  const updateProject = (id, data) => {
    const updated = updateProjectRecord(id, data);
    setAllProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    addAuditLog('Project Updated', currentUser.name, `Project ID: ${id}`);
    return updated;
  };

  const addProjectReport = (projectId, summary) => {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;

    const newReport = { 
      date: new Date().toISOString().split('T')[0], 
      timestamp: new Date().toISOString(), 
      summary, 
      by: currentUser.name, 
      immutable: true 
    };

    const updated = updateProjectRecord(projectId, {
      reports: [...(project.reports || []), newReport]
    });

    setAllProjects((prev) =>
      prev.map((p) => (p.id === projectId ? updated : p))
    );
    addAuditLog('Report Added', currentUser.name, `Project ID: ${projectId}`);
  };

  // ─── Attendance ───────────────────────────────────────────────────────────

  const markAttendance = async (userId, userName, type) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    let existing = allAttendance.find((a) => String(a.userId) === String(userId) && a.date === today);
    let updated;

    if (type === 'login') {
      if (existing) return;
      updated = {
        id: Date.now(),
        userId,
        userName,
        date: today,
        loginTime: now,
        logoutTime: null,
        breaks: [],
        meetings: [],
        status: 'Present',
      };
    } else {
      if (!existing) return;
      updated = { ...existing };
      
      if (type === 'logout') {
        updated.logoutTime = now;
      } else if (type === 'break-in') {
        if (updated.breaks.some(b => !b.endTime)) return; // Already in break
        updated.breaks = [...updated.breaks, { startTime: now, endTime: null, duration: 0 }];
      } else if (type === 'break-out') {
        const lastBreak = updated.breaks[updated.breaks.length - 1];
        if (!lastBreak || lastBreak.endTime) return; // No active break
        const endTime = now;
        const duration = (new Date(endTime) - new Date(lastBreak.startTime)) / 1000;
        const newBreaks = [...updated.breaks];
        newBreaks[newBreaks.length - 1] = { ...lastBreak, endTime, duration };
        updated.breaks = newBreaks;
      } else if (type === 'meeting-in') {
        if (updated.meetings.some(m => !m.endTime)) return; // Already in meeting
        updated.meetings = [...updated.meetings, { startTime: now, endTime: null, duration: 0 }];
      } else if (type === 'meeting-out') {
        const lastMeeting = updated.meetings[updated.meetings.length - 1];
        if (!lastMeeting || lastMeeting.endTime) return; // No active meeting
        const endTime = now;
        const duration = (new Date(endTime) - new Date(lastMeeting.startTime)) / 1000;
        const newMeetings = [...updated.meetings];
        newMeetings[newMeetings.length - 1] = { ...lastMeeting, endTime, duration };
        updated.meetings = newMeetings;
      }
    }

    try {
      const finalRecord = await upsertAttendanceLogDB(updated);
      setAllAttendance((prev) => {
        const prevExisting = prev.find((a) => String(a.userId) === String(userId) && a.date === today);
        if (!prevExisting && type === 'login') {
          return [...prev, finalRecord || updated];
        }
        return prev.map((a) => (String(a.userId) === String(userId) && a.date === today ? finalRecord || updated : a));
      });
      return finalRecord || updated;
    } catch (err) {
      console.error("[markAttendance] Failed:", err);
      throw err;
    }
  };

  const submitDailyReport = (userId, userName, date, workSummary) => {
    setAllAttendance((prev) => {
      const existing = prev.find((a) => a.userId === userId && a.date === date);
      if (existing) {
        return prev.map((a) => (a.userId === userId && a.date === date ? { ...a, workSummary } : a));
      }
      return [
        ...prev,
        {
          id: Date.now(),
          userId,
          userName,
          date,
          loginTime: null,
          logoutTime: null,
          breaks: [],
          meetings: [],
          status: 'Present',
          workSummary
        },
      ];
    });

    setTimeout(() => {
      setAllAttendance(current => {
        const recordToSync = current.find(a => a.userId === userId && a.date === date);
        if (recordToSync) {
          upsertAttendanceLogDB(recordToSync);
        } else {
          setAllAttendanceLogs(current);
        }
        return current;
      });
    }, 100);
    
    addAuditLog('Daily Report Submitted', userName, `Work summary submitted for ${date}`);
  };

  const manuallyUpsertAttendanceLog = async (logData) => {
    const updatedLog = await upsertAttendanceLogDB(logData);
    setAllAttendance((prev) => {
      const exists = prev.find(a => a.userId === logData.userId && a.date === logData.date);
      if (exists) {
        return prev.map(a => (a.userId === logData.userId && a.date === logData.date ? updatedLog : a));
      }
      return [...prev, updatedLog];
    });
    addAuditLog('Attendance Modified manually', currentUser.name, `Modified log for ${logData.userName} on ${logData.date}`);
  };

  // ─── Leave ────────────────────────────────────────────────────────────────

  const applyLeave = (leaveData) => {
    const newLeave = {
      ...leaveData,
      id: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      status: 'Pending',
      appliedOn: new Date().toISOString().split('T')[0],
    };
    setAllLeaves((prev) => [...prev, newLeave]);
    addAuditLog('Leave Applied', currentUser.name, `${leaveData.type} on ${leaveData.date}`);
  };

  const updateLeave = (id, status) => {
    setAllLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    addAuditLog('Leave Updated', currentUser.name, `Leave ID ${id} → ${status}`);
  };

  const deleteLeave = (id) => {
    setAllLeaves((prev) => prev.filter((l) => l.id !== id));
    addAuditLog('Leave Deleted', currentUser.name, `Leave ID ${id}`);
  };

  // ─── Messages ─────────────────────────────────────────────────────────────

  const sendMessage = (toId, toName, message) => {
    const newMsg = {
      id: Date.now(),
      fromId: currentUser.id,
      toId,
      fromName: currentUser.name,
      toName,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setAllMessages((prev) => [...prev, newMsg]);
  };

  // ─── Email Functions ─────────────────────────────────────────────────────────

  const updateEmailConfig = (userId, config) => {
    // ── Single Source of Truth Fix ──
    // Instead of saving to the user record, we use the canonical emailService
    const { addUserEmail, getEmailByUserId, updateUserEmail } = require('../services/emailService');
    
    const accounts = getEmailByUserId(userId);
    if (accounts && accounts.length > 0 && accounts[0]?.id) {
      updateUserEmail(accounts[0].id, {
        email: config.email,
        password: config.password,
        imapHost: config.imap?.host,
        imapPort: config.imap?.port,
        smtpHost: config.smtp?.host,
        smtpPort: config.smtp?.port
      });
    } else {
      const user = allUsers.find(u => u.id === userId || u.uuid === userId);
      if (user) {
        addUserEmail(user.uuid, user.name, user.role, config.email, config.password);
      }
    }
    
    // Trigger global refresh for all components (like OutlookEmailPage)
    window.dispatchEvent(new Event('storage'));
  };

  const sendEmail = async (paramsOrToEmail, subject, body, attachments = []) => {
    try {
      let toEmail, finalSubject, finalBody, finalAttachments;
      if (typeof paramsOrToEmail === 'object' && paramsOrToEmail !== null && paramsOrToEmail.to) {
        toEmail = paramsOrToEmail.to;
        finalSubject = paramsOrToEmail.subject || '';
        finalBody = { html: paramsOrToEmail.html || '', text: paramsOrToEmail.text || '' };
        finalAttachments = paramsOrToEmail.attachments || [];
      } else {
        toEmail = paramsOrToEmail;
        finalSubject = subject;
        finalBody = body;
        finalAttachments = attachments;
      }
      const emailServiceModule = await import('../services/emailService');
      const { getEmailByUserId, sendEmailViaSMTP } = emailServiceModule;
      const uid = currentUser?.uuid || currentUser?.id;
      const accounts = getEmailByUserId(uid, currentUser?.email);
      const emailConfig = accounts && accounts.length > 0 ? accounts[0] : null;

      if (!emailConfig?.email || !emailConfig?.password) {
        throw new Error('Email not configured. Please set up your email in Profile → Email Settings.');
      }
      
      await sendEmailViaSMTP(emailConfig, toEmail, finalSubject, finalBody, finalAttachments);
      
      const newEmail = {
        id: `email_${Date.now()}`,
        userId: currentUser.id,
        fromEmail: emailConfig.email,
        toEmail,
        subject,
        body,
        type: 'sent',
        status: 'sent',
        attachments,
        createdAt: new Date().toISOString(),
      };
      setAllEmails(prev => [...prev, newEmail]);
      addAuditLog('Email Sent', currentUser.name, `To: ${toEmail}, Subject: ${subject}`);
      return newEmail;
    } catch (error) {
      throw new Error('Failed to send email: ' + error.message);
    }
  };

  const getEmailsByUser = (userId, type = 'all') => {
    const emails = allEmails.filter(e => e.userId === userId);
    if (type === 'all') return emails;
    return emails.filter(e => e.type === type);
  };

  const syncEmails = async () => {
    const emailConfig = currentUser?.emailConfig;
    if (!emailConfig?.email || !emailConfig?.password) {
      console.log('Email not configured, skipping sync');
      return;
    }
    
    try {
      const emailServiceModule = await import('../services/emailService');
      const { syncEmails: doSync } = emailServiceModule;
      const result = await doSync({ ...emailConfig, userId: currentUser.id });
      
      if (result?.inbox?.length > 0 || result?.sent?.length > 0) {
        setAllEmails(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newInbox = result.inbox.filter(e => !existingIds.has(e.id));
          const newSent = result.sent.filter(e => !existingIds.has(e.id));
          return [...prev, ...newInbox, ...newSent];
        });
        addAuditLog('Email Sync', currentUser.name, `Synced ${result.inbox.length} inbox, ${result.sent.length} sent emails`);
      }
    } catch (error) {
      console.error('Email sync error:', error);
    }
  };

  // ─── Invoices ─────────────────────────────────────────────────────────────

  const updateInvoice = (id, data) => {
    const invoice = allInvoices.find(i => i.id === id);
    const userIsAdmin = currentUser?.role === ROLES.ADMIN;
    if (!userIsAdmin) {
      const isOwner = invoice?.createdBy === currentUser?.id || 
        (() => {
          const sale = allSales.find(s => s.id === invoice?.saleId);
          return sale && (sale.createdBy || sale.closedBy) === currentUser?.id;
        })();
      if (!isOwner) {
        throw new Error('You can only update your own invoices');
      }
    }
    updateInvoiceService(id, data, currentUser?.name);
    
    // Sync with Sale if linked - persist to database
    if (invoice?.saleId && data.totalAmount !== undefined) {
      try {
        const updatedSale = updateSaleRecord(invoice.saleId, { amount: data.totalAmount });
        setAllSales(prev => prev.map(s => {
          if (s.id === invoice.saleId) {
            return { ...s, ...updatedSale };
          }
          return s;
        }));
      } catch (error) {
        console.error('Failed to update sale record:', error);
      }
    }
    
    setAllInvoices(getAllInvoices());
    addAuditLog('Invoice Updated', currentUser?.name || 'System', `Invoice ${id} - Amount: ${data.totalAmount}`);
  };

  const refreshInvoices = () => {
    setAllInvoices(getAllInvoices());
  };

  const deleteInvoice = (id) => {
    // First find the invoice to get saleId before deleting
    const invoice = allInvoices.find(i => i.id === id);
    const userIsAdmin = currentUser?.role === ROLES.ADMIN;
    
    if (!userIsAdmin) {
      // For non-admin, check ownership
      const sale = invoice?.saleId ? allSales.find(s => s.id === invoice.saleId) : null;
      const isOwner = invoice?.createdBy === currentUser?.id || (sale && (sale.createdBy || sale.closedBy) === currentUser?.id);
      if (!isOwner) {
        throw new Error('You can only delete your own invoices');
      }
    }
    
    // Get saleId before deleting
    const saleId = invoice?.saleId;
    
    // Delete from localStorage (the actual database)
    deleteInvoiceFromStorage(id);
    
    // Update React state to reflect changes
    setAllInvoices(getAllInvoices());
    
    // Update sale if linked - persist to database
    if (saleId) {
      try {
        const updatedSale = updateSaleRecord(saleId, { invoiceStatus: 'Deleted', invoiceId: null });
        setAllSales(prev => prev.map(s => 
          s.id === saleId ? { ...s, ...updatedSale } : s
        ));
      } catch (error) {
        console.error('Failed to update sale record:', error);
      }
    }
    
    // Log the action
    addAuditLog('Invoice Deleted', currentUser?.name || 'System', `Invoice ${id}`);
  };

  // ─── Meeting Timer ─────────────────────────────────────────────────────────

  const startMeeting = () => {
    if (!currentUser) return null;
    const active = getActiveMeetingService(currentUser.id);
    if (active) return active; // 🧠 Prevent double start

    const newMeeting = startMeetingService(currentUser.id, currentUser.name);
    markAttendance(currentUser.id, currentUser.name, 'meeting-in');
    return newMeeting;
  };

  const endMeeting = () => {
    if (!currentUser) return null;
    const active = getActiveMeetingService(currentUser.id);
    if (!active) return null; // 🧠 Prevent double end

    const endedMeeting = endMeetingService(currentUser.id);
    markAttendance(currentUser.id, currentUser.name, 'meeting-out');
    return endedMeeting;
  };

  const getActiveMeeting = () => {
    if (!currentUser) return null;
    return getActiveMeetingService(currentUser.id);
  };

  const getMyMeetingStats = (days = 7) => {
    if (!currentUser) return { totalSeconds: 0, meetingCount: 0, avgDuration: 0, logs: [] };
    return getMeetingStats(currentUser.id, days);
  };

  // ─── Derived values ───────────────────────────────────────────────────────

  const isAdmin = currentUser?.role === ROLES.ADMIN;

  const myLeads = currentUser
    ? isAdmin
      ? allLeads
      : allLeads.filter((l) => String(l.createdBy) === String(currentUser.id) || String(l.assignedTo) === String(currentUser.id))
    : [];

  const myAssignedLeads = currentUser
    ? allLeads.filter((l) => String(l.assignedTo) === String(currentUser.id))
    : [];

  const myCustomers = currentUser
    ? isAdmin
      ? allSales
      : allSales.filter((s) => String(s.createdBy) === String(currentUser.id) || String(s.closedBy) === String(currentUser.id))
    : [];

  const myProjects = currentUser
    ? isAdmin
      ? allProjects
      : allProjects.filter((p) => {
          if (p.assignedMembers && Array.isArray(p.assignedMembers)) {
            return p.assignedMembers.map(String).includes(String(currentUser.id));
          }
          return String(p.assignedTo) === String(currentUser.id);
        })
    : [];

  const myInvoices = currentUser
    ? isAdmin
      ? allInvoices
      : allInvoices.filter((i) => {
          if (String(i.createdBy) === String(currentUser.id)) return true;
          const sale = allSales.find(s => String(s.id) === String(i.saleId));
          return sale && (String(sale.createdBy) === String(currentUser.id) || String(sale.closedBy) === String(currentUser.id));
        })
    : [];

  const unreadMessages = currentUser
    ? allMessages.filter((m) => m.toId === currentUser.id && !m.read).length
    : 0;

  // ─── RBAC helpers exposed to UI ───────────────────────────────────────────
  const rbac = {
    can: (permission) => can(currentUser, permission),
    canUploadImageFor: (targetUuid) => canUploadImageFor(currentUser, targetUuid),
  };

  return (
    <>
      <AppContext.Provider
        value={{
          // Auth
          currentUser, login, logout, sessionStart,
          // Users
          allUsers, createUser, updateUser, deleteUser,
          updateEmployeeId,
          uploadEmployeeProfileImage, deleteEmployeeProfileImage,
          // Leads
          allLeads, myLeads, myAssignedLeads, createLead, updateLead, addRemark, checkPhoneDuplicate, bulkDeleteLeads,
          // Sales
          allSales, myCustomers, createSale, updateSale, deleteCustomer,
          // Invoices
          allInvoices, myInvoices, updateInvoice, refreshInvoices, deleteInvoice,
          // Projects
          allProjects, myProjects, createProject, updateProject, deleteProject, addProjectReport,
          // HR
          allAttendance, markAttendance, submitDailyReport, manuallyUpsertAttendanceLog,
          allLeaves, applyLeave, updateLeave, deleteLeave,
          // Chat
          allMessages, sendMessage, unreadMessages,
          // Enhanced chat system
          getOrCreateDirectChat: (user2Id) => getOrCreateChat(currentUser.id, user2Id, allUsers),
          ensureDepartmentChat: (dept) => ensureDeptChat(dept, allUsers),
          getTotalChatUnread: () => getTotalChatUnread(currentUser.id),
          // Email
          allEmails, updateEmailConfig, sendEmail, getEmailsByUser, syncEmails,
          // Audit
          allAuditLogs, addAuditLog,
          // Notifications
          allNotifications, addNotification, markNotificationRead, getNotificationsByUser, getUnreadNotificationsCount,
          // Meeting Timer
          startMeeting, endMeeting, getActiveMeeting, getMyMeetingStats,
          // Navigation
          activePage, setActivePage,
          // RBAC helpers
          rbac,
          forcePasswordChange,
          setForcePasswordChange,
        }}
      >
        {children}
      </AppContext.Provider>

      {alertModal && (
        <div className="modal-overlay" onClick={hideAlertModal}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{alertModal.title}</div>
              <button className="btn btn-ghost" onClick={hideAlertModal}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: 1.6 }}>{alertModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={hideAlertModal}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const useApp = () => useContext(AppContext);
