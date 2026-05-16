/**
 * rbacService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised RBAC permission definitions and guard helpers.
 *
 * In a real system these same checks are duplicated server-side as Express/
 * NestJS middleware.  The frontend copy prevents unauthorised UI interactions;
 * the backend copy is the authoritative security boundary.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ROLES } from '../data/mockData';

// ─── Permission Map ──────────────────────────────────────────────────────────

export const PERMISSIONS = {

  // Employee ID (business identifier)
  EDIT_EMPLOYEE_ID: [ROLES.ADMIN],                     // Admin only

  // Profile image management
  UPLOAD_OWN_PROFILE_IMAGE: [                          // Self-update
    ROLES.ADMIN, ROLES.HR, ROLES.SALES, ROLES.BACKEND,
    ROLES.ACCOUNTS, ROLES.SUPPORT, ROLES.QUALITY, ROLES.TRAINEE,
    ROLES.GRAPHICS_MANAGER, ROLES.GRAPHIC_DESIGNER,
    ROLES.JUNIOR_GRAPHIC_DESIGNER, ROLES.VIDEO_EDITOR,
    ROLES.MOTION_GRAPHIC_DESIGNER,
  ],
  UPLOAD_ANY_PROFILE_IMAGE: [ROLES.ADMIN],             // Admin can upload for anyone
  REPLACE_PROFILE_IMAGE: [ROLES.ADMIN],             // Admin can replace any
  DELETE_PROFILE_IMAGE: [ROLES.ADMIN],             // Admin can delete any
  VIEW_PROFILE_IMAGE: [                          // HR + Admin can view all
    ROLES.ADMIN, ROLES.HR,
  ],

  // General user data
  VIEW_ALL_EMPLOYEES: [ROLES.ADMIN, ROLES.HR],
  EDIT_EMPLOYEE_PROFILE: [ROLES.ADMIN, ROLES.HR],
  DELETE_EMPLOYEE: [ROLES.ADMIN],
  VIEW_SENSITIVE_DATA: [ROLES.ADMIN, ROLES.HR],             // Salary, Aadhaar, PAN unmasked
  VIEW_AUDIT_LOGS: [ROLES.ADMIN],

  // Leads
  DELETE_LEAD: [ROLES.ADMIN, 'Sales Manager'],
};

// ─── Guard Helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if `user` holds at least one of the required roles for `permission`.
 */
export const can = (user, permission) => {
  if (!user) return false;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(user.role);
};

/**
 * Returns true if the user can upload / replace a profile image for `targetUuid`.
 * Employees may only update their own image.
 */
export const canUploadImageFor = (actorUser, targetUserUuid) => {
  if (!actorUser) return false;
  // Admin can upload for anyone
  if (can(actorUser, 'UPLOAD_ANY_PROFILE_IMAGE')) return true;
  // Any employee can update their own image
  if (actorUser.uuid === targetUserUuid && can(actorUser, 'UPLOAD_OWN_PROFILE_IMAGE')) return true;
  return false;
};

/**
 * Returns true if the actor can view the profile image of another user.
 */
export const canViewImageOf = (actorUser, targetUserUuid) => {
  if (!actorUser) return false;
  // Own image always visible
  if (actorUser.uuid === targetUserUuid) return true;
  // Admin and HR can view any employee image
  return can(actorUser, 'VIEW_PROFILE_IMAGE');
};

/**
 * Throws a PermissionError if the check fails (mirrors backend guard behaviour).
 * Use in service functions to enforce RBAC at the operation level, not just UI.
 */
export class PermissionError extends Error {
  constructor(message = 'Access denied: insufficient permissions.') {
    super(message);
    this.name = 'PermissionError';
    this.status = 403;
  }
}

export const requirePermission = (user, permission, context = '') => {
  if (!can(user, permission)) {
    throw new PermissionError(
      `Access denied: role "${user?.role}" cannot perform "${permission}".${context ? ' ' + context : ''}`
    );
  }
};
