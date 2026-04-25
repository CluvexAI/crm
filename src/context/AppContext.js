import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  users as initialUsers,
  leads as initialLeads,
  sales as initialSales,
  projects as initialProjects,
  attendance as initialAttendance,
  leaveRequests as initialLeaves,
  messages as initialMessages,
  auditLogs as initialAudit,
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
  getMeetingDuration,
  formatMeetingDuration,
  getAllMeetingLogs,
  getMeetingStats,
} from '../services/meetingService';
import {
  createInvoice,
  updateInvoice as updateInvoiceService,
  getAllInvoices
} from '../services/invoiceService';

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
  const [allAuditLogs, setAllAuditLogs] = useState(initialAudit);
  const [sessionStart, setSessionStart] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const initUsers = async () => {
      const hashedUsers = await Promise.all(
        initialUsers.map(async (user) => {
          if (!isPasswordHashed(user.password)) {
            const hashed = await hashPassword(user.password);
            return { ...user, password: hashed };
          }
          return user;
        })
      );
      setAllUsers(hashedUsers);

      let storedInvoices = getAllInvoices();
      if (storedInvoices.length === 0 && initialSales.length > 0) {
        initialSales.forEach(sale => createInvoice(sale));
        storedInvoices = getAllInvoices();
      }
      setAllInvoices(storedInvoices);

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

  // ─── Authentication ───────────────────────────────────────────────────────

  const login = async (email, password) => {
    const user = allUsers.find((u) => u.email === email);
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (isValidPassword) {
      setCurrentUser(user);
      setSessionStart(new Date());
      addAuditLog('User Login', user.name, `Successful login — ${email}`);
      return { success: true, user };
    }
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
    const existingEmpId = allUsers.find(
      (u) => u.employeeId === userData.employeeId
    );
    if (existingEmpId) throw new Error(`Employee ID "${userData.employeeId}" already exists.`);

    const newUser = {
      ...userData,
      // Immutable internal primary key — generated once, never editable
      uuid: generateUUID(),
      id: Date.now(), // legacy numeric ref for existing FK relations
      employeeId: userData.employeeId || `EMP-${String(allUsers.length + 1).padStart(3, '0')}`,
      status: 'Active',
      profileImageUrl: null,
      profileImageSize: null,
      profileImageType: null,
      profileImageName: null,
      profileImageUploadedAt: null,
    };
    setAllUsers((prev) => [...prev, newUser]);
    addAuditLog('User Created', currentUser.name, `Created: ${userData.name} (${newUser.employeeId}) [UUID: ${newUser.uuid}]`);
    return newUser;
  };

  /**
   * Update general employee profile fields.
   * uuid and id fields are stripped so they can never be overwritten.
   */
  const updateUser = (uuid, userData) => {
    // eslint-disable-next-line no-unused-vars
    const { uuid: _u, id: _i, ...safeData } = userData;
    setAllUsers((prev) =>
      prev.map((u) => (u.uuid === uuid ? { ...u, ...safeData } : u))
    );
    addAuditLog('User Updated', currentUser.name, `Updated employee UUID: ${uuid}`);
    // Keep currentUser in sync if user updated themselves
    if (currentUser && currentUser.uuid === uuid) {
      setCurrentUser((prev) => ({ ...prev, ...safeData }));
    }
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

    setAllUsers((prev) =>
      prev.map((u) =>
        u.uuid === targetUuid
          ? {
            ...u,
            profileImageUrl: imageData.url,
            profileImageSize: imageData.size,
            profileImageType: imageData.type,
            profileImageName: imageData.name,
            profileImageUploadedAt: imageData.uploadedAt,
          }
          : u
      )
    );

    // Keep currentUser in sync if uploading own image
    if (currentUser && currentUser.uuid === targetUuid) {
      setCurrentUser((prev) => ({
        ...prev,
        profileImageUrl: imageData.url,
        profileImageSize: imageData.size,
        profileImageType: imageData.type,
        profileImageName: imageData.name,
        profileImageUploadedAt: imageData.uploadedAt,
      }));
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

    setAllUsers((prev) =>
      prev.map((u) =>
        u.uuid === targetUuid
          ? { ...u, profileImageUrl: null, profileImageSize: null, profileImageType: null, profileImageName: null, profileImageUploadedAt: null }
          : u
      )
    );

    if (currentUser?.uuid === targetUuid) {
      setCurrentUser((prev) => ({
        ...prev,
        profileImageUrl: null,
        profileImageSize: null,
        profileImageType: null,
        profileImageName: null,
        profileImageUploadedAt: null,
      }));
    }

    addAuditLog('Profile Image Deleted', currentUser.name, `Image removed for ${target?.name} (${target?.employeeId})`);
  };

  const deleteUser = (uuid) => {
    requirePermission(currentUser, 'DELETE_EMPLOYEE');
    const target = allUsers.find((u) => u.uuid === uuid);
    setAllUsers((prev) => prev.filter((u) => u.uuid !== uuid));
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
    setAllLeads((prev) => [...prev, newLead]);
    addAuditLog('Lead Created', currentUser.name, `${leadData.contactName} (${leadData.businessName})`);
    return newLead;
  };

  const updateLead = (id, leadData) => {
    setAllLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...leadData, lastFollowUp: new Date().toISOString() } : l))
    );
    addAuditLog('Lead Updated', currentUser.name, `Lead ID: ${id}`);
  };

  const bulkDeleteLeads = (ids) => {
    setAllLeads(prev => prev.filter(l => !ids.includes(l.id)));
  };

  const addRemark = (leadId, text) => {
    setAllLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
            ...l,
            lastFollowUp: new Date().toISOString(),
            remarks: [...(l.remarks || []), { text, timestamp: new Date().toISOString(), by: currentUser.name }],
          }
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
    const newSale = { ...saleData, id: Date.now(), createdAt: new Date().toISOString() };
    setAllSales((prev) => [...prev, newSale]);

    createInvoice(newSale);
    setAllInvoices(getAllInvoices());

    const project = {
      id: Date.now() + 1,
      saleId: newSale.id,
      projectName: `${saleData.businessName} - ${saleData.proposalType}`,
      clientName: saleData.businessName,
      assignedTo: null,
      assignedToName: 'Unassigned',
      status: 'Planning',
      startDate: new Date().toISOString().split('T')[0],
      reports: [],
      wpUrl: '', wpUsername: '', wpPassword: '',
      domainRegistrar: '', domainUsername: '', domainPassword: '',
      cpanelUser: '', cpanelPass: '', facebookPage: '', gmailAcc: '',
    };
    setAllProjects((prev) => [...prev, project]);
    addAuditLog('Sale Created', currentUser.name, `${saleData.proposalType} — ₹${saleData.amount}`);
    return newSale;
  };

  // ─── Projects ─────────────────────────────────────────────────────────────

  const updateProject = (id, data) => {
    setAllProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    addAuditLog('Project Updated', currentUser.name, `Project ID: ${id}`);
  };

  const addProjectReport = (projectId, summary) => {
    setAllProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
            ...p,
            reports: [
              ...(p.reports || []),
              { date: new Date().toISOString().split('T')[0], summary, by: currentUser.name, immutable: true },
            ],
          }
          : p
      )
    );
    addAuditLog('Report Added', currentUser.name, `Project ID: ${projectId}`);
  };

  // ─── Attendance ───────────────────────────────────────────────────────────

  const markAttendance = (userId, userName, type) => {
    const today = new Date().toISOString().split('T')[0];
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
            loginTime: new Date().toTimeString().split(' ')[0],
            logoutTime: null,
            breaks: [],
            meetings: [],
            status: 'Present',
          },
        ];
      }
      if (type === 'logout') {
        return prev.map((a) =>
          a.userId === userId && a.date === today
            ? { ...a, logoutTime: new Date().toTimeString().split(' ')[0] }
            : a
        );
      }
      return prev;
    });
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

  // ─── Invoices ─────────────────────────────────────────────────────────────

  const updateInvoice = (id, data) => {
    updateInvoiceService(id, data, currentUser?.name);
    setAllInvoices(getAllInvoices());
    addAuditLog('Invoice Updated', currentUser?.name || 'System', `Invoice ${id}`);
  };

  const refreshInvoices = () => {
    setAllInvoices(getAllInvoices());
  };

  // ─── Meeting Timer ─────────────────────────────────────────────────────────

  const startMeeting = () => {
    if (!currentUser) return null;
    return startMeetingService(currentUser.id, currentUser.name);
  };

  const endMeeting = () => {
    if (!currentUser) return null;
    return endMeetingService(currentUser.id);
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

  const myLeads = currentUser
    ? currentUser.role === 'Admin'
      ? allLeads
      : allLeads.filter((l) => l.createdBy === currentUser.id)
    : [];

  const myProjects = currentUser
    ? currentUser.role === 'Admin'
      ? allProjects
      : allProjects.filter((p) => p.assignedTo === currentUser.id)
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
        allLeads, myLeads, createLead, updateLead, addRemark, checkPhoneDuplicate, bulkDeleteLeads,
        // Sales
        allSales, createSale,
        // Invoices
        allInvoices, updateInvoice, refreshInvoices,
        // Projects
        allProjects, myProjects, updateProject, addProjectReport,
        // HR
        allAttendance, markAttendance,
        allLeaves, applyLeave, updateLeave,
        // Chat
        allMessages, sendMessage, unreadMessages,
        // Audit
        allAuditLogs, addAuditLog,
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
