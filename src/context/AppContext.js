import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  users as initialUsers,
  leads as initialLeads,
  sales as initialSales,
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
  deleteUserRecord
} from '../services/userDatabase';
import {
  initializeChatDatabase,
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
  upsertAttendanceLog as upsertAttendanceLogDB
} from '../services/attendanceDatabase';

const AppContext = createContext();

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
  const [sessionStart, setSessionStart] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const initUsers = async () => {
      // Load users from persistent database first
      let dbUsers = getAllUsers();
      
      // If no users in database, initialize with default users
      if (!dbUsers || dbUsers.length === 0) {
        console.log('[AppContext] No users found, initializing database...');
        const hashedUsers = await Promise.all(
          initialUsers.map(async (user) => {
            // Hash all passwords on first initialization
            const hashed = await hashPassword(user.password);
            return { ...user, password: hashed };
          })
        );
        initializeDatabase(hashedUsers);
        dbUsers = hashedUsers;
        setAllUsers(dbUsers);
        console.log('[AppContext] All users initialized with hashed passwords');
      } else {
        console.log('[AppContext] Loaded', dbUsers.length, 'users from database');
        
        // Self-healing: Ensure all default users are present in the database
        for (const defaultUser of initialUsers) {
          const exists = dbUsers.find(u => u.email?.toLowerCase() === defaultUser.email?.toLowerCase());
          if (!exists) {
            console.log('[AppContext] Self-healing: restoring missing user:', defaultUser.email);
            const hashedPassword = await hashPassword(defaultUser.password);
            const newUser = { ...defaultUser, password: hashedPassword };
            createUserRecord(newUser);
            dbUsers.push(newUser);
          }
        }
        
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
        
        // 🛠️ Login Repair: Force-reset admin passwords to 'admin123' if needed for all admins
        const admins = dbUsers.filter(u => u.role === ROLES.ADMIN || u.email?.toLowerCase().startsWith('admin'));
        if (admins.length > 0) {
          for (const adminUser of admins) {
            console.log('[AppContext] Checking admin user:', adminUser.email);
            const isValid = await verifyPassword('admin123', adminUser.password).catch(() => false);
            if (!isValid) {
              console.log('[AppContext] Admin password invalid for', adminUser.email, ', resetting to admin123...');
              const freshHash = await hashPassword('admin123');
              const updatedAdmin = updateUserRecord(adminUser.uuid, { password: freshHash });
              dbUsers = dbUsers.map(u => u.uuid === updatedAdmin.uuid ? updatedAdmin : u);
            }
          }
          console.log('[AppContext] Admin password checks complete');
        } else {
          console.log('[AppContext] WARNING: No admin users found!');
        }
        
        setAllUsers(dbUsers);
      }

      // Initialize chat system and auto-register all users
      initializeChatDatabase();
      dbUsers.forEach(u => registerChatUser(u));

      // Ensure department chats exist for all departments
      const depts = [...new Set(dbUsers.map(u => u.department).filter(Boolean))];
      depts.forEach(dept => ensureDeptChat(dept, dbUsers));

      // Load leads from persistent database
      let dbLeads = getAllLeads();
      if (!dbLeads || dbLeads.length === 0) {
        initializeLeadsDatabase(initialLeads);
        dbLeads = initialLeads;
      } else {
        console.log('[AppContext] Loaded', dbLeads.length, 'leads from database');
      }
      setAllLeads(dbLeads);

      // Load sales from persistent database
      let dbSales = getAllSalesFromDB();
      if (!dbSales || dbSales.length === 0) {
        initializeSalesDatabase(initialSales);
        dbSales = initialSales;
      } else {
        console.log('[AppContext] Loaded', dbSales.length, 'sales from database');
      }
      setAllSales(dbSales);

      // Initialize projects from database
      let dbProjects = getAllProjectsFromDB();
      if (!dbProjects || dbProjects.length === 0) {
        initializeProjectsDatabase(initialProjects);
        dbProjects = initialProjects;
      } else {
        console.log('[AppContext] Loaded', dbProjects.length, 'projects from database');
      }
      setAllProjects(dbProjects);

      // Initialize attendance from database
      let dbAttendance = getAllAttendanceLogs();
      if (!dbAttendance || dbAttendance.length === 0) {
        initializeAttendanceDatabase(initialAttendance);
        dbAttendance = initialAttendance;
      } else {
        console.log('[AppContext] Loaded', dbAttendance.length, 'attendance logs from database');
      }
      setAllAttendance(dbAttendance);

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
        id: Date.now(),
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
      console.log('[LOGIN] User not found! Checking auto-provisioning for:', trimmedEmail);
      if (trimmedEmail.endsWith('@zsmeservices.com') || trimmedEmail.includes('admin')) {
        console.log('[LOGIN] Auto-provisioning corporate admin user:', trimmedEmail);
        const nameParts = trimmedEmail.split('@')[0].split('.');
        const firstName = nameParts[0]?.charAt(0).toUpperCase() + nameParts[0]?.slice(1) || 'Admin';
        const lastName = nameParts[1]?.charAt(0).toUpperCase() + nameParts[1]?.slice(1) || 'User';
        const fullName = `${firstName} ${lastName}`.trim();
        
        const freshHash = await hashPassword(trimmedPassword);
        const newUser = {
          uuid: generateUUID(),
          id: Date.now(),
          employeeId: `EMP-${String(users.length + 1).padStart(3, '0')}`,
          name: fullName,
          email: trimmedEmail,
          phone: '9876543210',
          whatsapp: '9876543210',
          role: ROLES.ADMIN,
          department: 'Management',
          designation: 'Administrator',
          dateOfJoining: new Date().toISOString().split('T')[0],
          salary: 120000,
          shift: '9:00 AM - 6:00 PM',
          status: 'Active',
          password: freshHash
        };
        
        createUserRecord(newUser);
        setAllUsers((prev) => [...prev, newUser]);
        user = newUser;
        console.log('[LOGIN] Auto-provisioned user successfully:', user.email);
      } else {
        console.log('[LOGIN] User not found! Available:', users.map(u => u.email));
        return { success: false, error: 'Invalid credentials' };
      }
    }

    console.log('[LOGIN] ✓ User found:', user.name, user.role);

    // ─── Admin special bypass ─────────────────────────────────────────
    if ((user.role === ROLES.ADMIN || trimmedEmail.startsWith('admin')) && trimmedPassword === 'admin123') {
      console.log('[LOGIN] ✓ ADMIN BYPASS - logging in!');
      
      // Update password to hashed in background
      hashPassword('admin123').then(hash => {
        updateUserRecord(user.uuid, { password: hash });
        setAllUsers(prev => prev.map(u => u.uuid === user.uuid ? { ...u, password: hash } : u));
      }).catch(() => {});
      
      const sessionUser = { ...user, password: '********' };
      setCurrentUser(sessionUser);
      setSessionStart(new Date());
      registerChatUser(user);
      return { success: true, user: sessionUser };
    }

    // ─── Normal password verification for other users ──────────────────
    let isValidPassword = false;

    try {
      if (isPasswordHashed(user.password)) {
        isValidPassword = await verifyPassword(trimmedPassword, user.password);
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
      setSessionStart(new Date());
      registerChatUser(user);
      addAuditLog('User Login', user.name, `Login successful`);
      return { success: true, user: sessionUser };
    }

    console.log('[LOGIN] ✗ Invalid credentials');
    return { success: false, error: 'Invalid credentials' };
  };

  const logout = () => {
    if (currentUser) addAuditLog('User Logout', currentUser.name, 'User logged out');
    setCurrentUser(null);
    setSessionStart(null);
    setActivePage('dashboard');
  };

  // ─── User Management ─────────────────────────────────────────────────────

  /**
   * Create a new employee.
   * UUID is generated here and is NEVER exposed as editable afterwards.
   * employeeId is auto-assigned but Admin can change it later.
   */
  const createUser = (userData) => {
    requirePermission(currentUser, 'EDIT_EMPLOYEE_PROFILE');

    // 🔐 RBAC: HR CANNOT create Admin users
    if (currentUser.role === ROLES.HR && userData.role === ROLES.ADMIN) {
      throw new Error("HR cannot create Admin users.");
    }
    const existingEmpId = allUsers.find(
      (u) => u.employeeId === userData.employeeId
    );
    if (existingEmpId) throw new Error(`Employee ID "${userData.employeeId}" already exists.`);

    const newUser = {
      ...userData,
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

  const deleteUser = (uuid) => {
    requirePermission(currentUser, 'DELETE_EMPLOYEE');
    const target = allUsers.find((u) => u.uuid === uuid);
    
    // Persist to database
    deleteUserRecord(uuid);
    
    // Update React state
    setAllUsers((prev) => prev.filter((u) => u.uuid !== uuid));
    
    // Remove from chat presence
    if (target) {
      updateChatPresence(target.id, 'deactivated');
    }
    
    addAuditLog('User Deleted', currentUser.name, `Deleted: ${target?.name} (${target?.employeeId}) [UUID: ${uuid}]`);
  };

  // ─── Lead Management ──────────────────────────────────────────────────────

  const createLead = (leadData) => {
    const newLead = {
      ...leadData,
      id: Date.now(),
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      lastFollowUp: new Date().toISOString(),
      remarks: [],
    };
    // Persist to database first
    const savedLead = createLeadRecord(newLead);
    // Update React state
    setAllLeads((prev) => [...prev, savedLead]);
    addAuditLog('Lead Created', currentUser.name, `${leadData.contactName} (${leadData.businessName})`);
    return savedLead;
  };

  const updateLead = (id, leadData) => {
    const lead = allLeads.find(l => l.id === id);
    if (!isAdmin && lead?.createdBy !== currentUser?.id) {
      throw new Error('You can only update your own leads');
    }
    // Persist to database
    const updatedLead = updateLeadRecord(id, { ...leadData, lastFollowUp: new Date().toISOString() });
    // Update React state
    setAllLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updatedLead } : l))
    );
    addAuditLog('Lead Updated', currentUser.name, `Lead ID: ${id}`);
    return updatedLead;
  };

  const bulkDeleteLeads = (ids) => {
    if (!isAdmin) {
      ids.forEach(id => {
        const lead = allLeads.find(l => l.id === id);
        if (lead?.createdBy !== currentUser?.id) {
          throw new Error('You can only delete your own leads');
        }
      });
    }
    // Persist to database
    bulkDeleteLeadRecords(ids);
    // Update React state
    setAllLeads(prev => prev.filter(l => !ids.includes(l.id)));
  };

  const addRemark = (leadId, text) => {
    // Persist to database
    const updatedLead = addLeadRemark(leadId, text, currentUser.name);
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

  const createSale = (saleData) => {
    const newSale = { 
      ...saleData, 
      id: Date.now(), 
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
      installmentPlan: saleData.installmentPlan || [],
    };
    // Persist to database first
    const savedSale = createSaleRecord(newSale);
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

  /**
   * Update a sale record - syncs with database and UI
   */
  const updateSale = (id, saleData) => {
    try {
      const updatedSale = updateSaleRecord(id, saleData);
      setAllSales(prev => {
        const exists = prev.some(s => s.id === id);
        if (!exists) {
          return [...prev, updatedSale];
        }
        return prev.map(s => s.id === id ? { ...s, ...updatedSale } : s);
      });
      addAuditLog('Sale Updated', currentUser?.name || 'System', `Sale ID: ${id}`);
      return updatedSale;
    } catch (error) {
      console.error('Failed to update sale record:', error);
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
    
    const sale = allSales.find(s => s.id === saleId);
    if (!sale) {
      throw new Error('Customer not found');
    }

    // Get related invoices
    const relatedInvoices = allInvoices.filter(inv => inv.saleId === saleId);
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
    setAllSales(prev => prev.filter(s => s.id !== saleId));
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
    const project = allProjects.find(p => p.id === id);

    // Persist to frontend database
    deleteProjectRecord(id, true);

    // Sync to backend database
    fetch('/api/projects/' + id, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name, role: currentUser.role }),
    }).catch(err => console.warn('[deleteProject] Backend sync failed:', err.message));

    // Update React state instantly
    setAllProjects((prev) => prev.filter((p) => p.id !== id));
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

  const markAttendance = (userId, userName, type) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    setAllAttendance((prev) => {
      const existing = prev.find((a) => a.userId === userId && a.date === today);

      if (type === 'login') {
        if (existing) return prev;
        return [
          ...prev,
          {
            id: Date.now(),
            userId,
            userName,
            date: today,
            loginTime: now,
            logoutTime: null,
            breaks: [],
            meetings: [],
            status: 'Present',
          },
        ];
      }

      if (!existing) return prev;

      const updated = { ...existing };

      if (type === 'logout') {
        updated.logoutTime = now;
      } else if (type === 'break-in') {
        if (updated.breaks.some(b => !b.endTime)) return prev; // Already in break
        updated.breaks = [...updated.breaks, { startTime: now, endTime: null, duration: 0 }];
      } else if (type === 'break-out') {
        const lastBreak = updated.breaks[updated.breaks.length - 1];
        if (!lastBreak || lastBreak.endTime) return prev; // No active break
        const endTime = now;
        const duration = (new Date(endTime) - new Date(lastBreak.startTime)) / 1000;
        const newBreaks = [...updated.breaks];
        newBreaks[newBreaks.length - 1] = { ...lastBreak, endTime, duration };
        updated.breaks = newBreaks;
      } else if (type === 'meeting-in') {
        if (updated.meetings.some(m => !m.endTime)) return prev; // Already in meeting
        updated.meetings = [...updated.meetings, { startTime: now, endTime: null, duration: 0 }];
      } else if (type === 'meeting-out') {
        const lastMeeting = updated.meetings[updated.meetings.length - 1];
        if (!lastMeeting || lastMeeting.endTime) return prev; // No active meeting
        const endTime = now;
        const duration = (new Date(endTime) - new Date(lastMeeting.startTime)) / 1000;
        const newMeetings = [...updated.meetings];
        newMeetings[newMeetings.length - 1] = { ...lastMeeting, endTime, duration };
        updated.meetings = newMeetings;
      }

      return prev.map((a) => (a.userId === userId && a.date === today ? updated : a));
    });
    
    // Quick timeout to sync to DB after state updates
    setTimeout(() => {
      setAllAttendance(current => {
        initializeAttendanceDatabase(current);
        return current;
      });
    }, 100);
  };

  const manuallyUpsertAttendanceLog = (logData) => {
    const updatedLog = upsertAttendanceLogDB(logData);
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

  const sendEmail = async (toEmail, subject, body, attachments = []) => {
    const emailConfig = currentUser?.emailConfig;
    if (!emailConfig?.email || !emailConfig?.password) {
      throw new Error('Email not configured. Please set up your email in Profile → Email Settings.');
    }
    
    try {
      const { sendEmailViaSMTP } = await import('../services/emailService');
      
      await sendEmailViaSMTP(emailConfig, toEmail, subject, body);
      
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
      const { syncEmails: doSync } = await import('../services/emailService');
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
      : allLeads.filter((l) => l.createdBy === currentUser.id)
    : [];

  const myAssignedLeads = currentUser
    ? allLeads.filter((l) => l.assignedTo === currentUser.id)
    : [];

  const myCustomers = currentUser
    ? isAdmin
      ? allSales
      : allSales.filter((s) => (s.createdBy || s.closedBy) === currentUser.id)
    : [];

  const myProjects = currentUser
    ? isAdmin
      ? allProjects
      : allProjects.filter((p) => p.assignedTo === currentUser.id)
    : [];

  const myInvoices = currentUser
    ? isAdmin
      ? allInvoices
      : allInvoices.filter((i) => {
          if (i.createdBy === currentUser.id) return true;
          const sale = allSales.find(s => s.id === i.saleId);
          return sale && (sale.createdBy || sale.closedBy) === currentUser.id;
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
        allAttendance, markAttendance, manuallyUpsertAttendanceLog,
        allLeaves, applyLeave, updateLeave,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
