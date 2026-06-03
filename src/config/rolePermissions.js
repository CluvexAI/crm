import { ROLES } from '../data/mockData';

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    user_management: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
      can_export: true,
      visible_columns: ['Photo', 'Employee', 'Emp ID', 'UUID', 'Role', 'Department', 'Phone', 'Status', 'Actions'],
      visible_departments: 'ALL',
      default_filter: { status: ['Active', 'Inactive'] }
    },
    hr_module: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
      visible_columns: ['Employee', 'Emp ID', 'Role', 'Department', 'Status', 'Actions'],
      visible_departments: 'ALL',
      default_filter: { status: ['Active', 'Inactive'] }
    }
  },
  [ROLES.HR]: {
    user_management: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
      visible_columns: ['Photo', 'Employee', 'Emp ID', 'Role', 'Department', 'Phone', 'Status', 'Actions'],
      visible_departments: 'ALL',
      default_filter: { status: ['Active', 'Inactive'] }
    },
    hr_module: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
      visible_columns: ['Employee', 'Emp ID', 'Role', 'Department', 'Status', 'Actions'],
      visible_departments: 'ALL',
      default_filter: { status: ['Active', 'Inactive'] }
    }
  }
};

/**
 * Retrieves the configuration for a given role and module.
 */
export const getRoleConfig = (role, module) => {
  return ROLE_PERMISSIONS[role]?.[module] || null;
};

/**
 * Uniform filtering function for employee lists.
 * Ensures that all users of the same role see the exact same subset of data.
 */
export const getVisibleUsers = (allUsers, currentUser, module, searchTerm = '', deptFilter = 'All', roleFilter = 'All') => {
  const config = getRoleConfig(currentUser.role, module);
  if (!config || !config.can_view) return [];

  return allUsers.filter(u => {
    // Always hide permanently deleted users
    if (u.status === 'Deleted') return false;

    // HR users cannot see Admin users in either module
    if (currentUser.role === ROLES.HR && u.role === ROLES.ADMIN) return false;

    // Role and Department filters from the UI
    const matchRole = roleFilter === 'All' || u.role === roleFilter;
    const matchDept = deptFilter === 'All' || u.department === deptFilter;

    // Search filter — guard against missing fields
    const name  = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const empId = (u.employeeId || '').toLowerCase();
    const term  = (searchTerm || '').toLowerCase();
    const matchSearch = !term || name.includes(term) || email.includes(term) || empId.includes(term);

    return matchRole && matchDept && matchSearch;
  });
};
