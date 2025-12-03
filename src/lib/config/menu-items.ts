/**
 * Centralized menu items registry
 * When you add new menu items, update this file and run the sync
 */

export interface MenuItem {
  path: string;
  label: string;
  section: 'main' | 'marketing' | 'sales' | 'operations' | 'admin';
  icon: string;
}

export const MENU_ITEMS: MenuItem[] = [
  // Main Navigation
  {
    path: '/dashboard',
    label: 'Dashboard',
    section: 'main',
    icon: 'Dashboard',
  },
  {
    path: '/dashboard/coordinator',
    label: 'Coordinator',
    section: 'main',
    icon: 'AssignmentTurnedIn',
  },
  {
    path: '/dashboard/order-items',
    label: 'Order Items',
    section: 'main',
    icon: 'ShoppingCart',
  },
  {
    path: '/dashboard/report-card',
    label: 'Report Card',
    section: 'main',
    icon: 'Assessment',
  },
  // Marketing
  {
    path: '/dashboard/campaigns',
    label: 'Campaigns',
    section: 'marketing',
    icon: 'Event',
  },
  {
    path: '/dashboard/leads',
    label: 'Leads',
    section: 'marketing',
    icon: 'GroupAdd',
  },
  {
    path: '/dashboard/reports',
    label: 'Reports',
    section: 'marketing',
    icon: 'BarChart',
  },

  // Sales
  {
    path: '/dashboard/programs',
    label: 'Programs',
    section: 'sales',
    icon: 'School',
  },
  {
    path: '/documents',
    label: 'Documents',
    section: 'sales',
    icon: 'Description',
  },

  // Operations
  {
    path: '/dashboard/inventory-forecast',
    label: 'Inventory Forecast',
    section: 'operations',
    icon: 'Assessment',
  },
  {
    path: '/dashboard/inventory-management',
    label: 'Inventory Management',
    section: 'operations',
    icon: 'Inventory',
  },
  {
    path: '/dashboard/item-requests',
    label: 'Item Requests',
    section: 'operations',
    icon: 'Inventory',
  },
  {
    path: '/dashboard/program-analytics',
    label: 'Program Analytics',
    section: 'operations',
    icon: 'BarChart',
  },

  // Admin (alphabetical)
  {
    path: '/dashboard/audit-report',
    label: 'Audit Report',
    section: 'admin',
    icon: 'History',
  },
  {
    path: '/dashboard/payments',
    label: 'Payments',
    section: 'admin',
    icon: 'Payment',
  },
  {
    path: '/dashboard/admin/program-audit',
    label: 'Program Audit',
    section: 'admin',
    icon: 'FactCheck',
  },
  {
    path: '/dashboard/admin/program-templates',
    label: 'Program Templates',
    section: 'admin',
    icon: 'Description',
  },
  {
    path: '/dashboard/admin/system-jobs',
    label: 'System Jobs',
    section: 'admin',
    icon: 'Schedule',
  },
  {
    path: '/dashboard/admin/analytics',
    label: 'Dashboard Analytics',
    section: 'admin',
    icon: 'Dashboard',
  },
  {
    path: '/dashboard/therapies',
    label: 'Therapies',
    section: 'admin',
    icon: 'LocalHospital',
  },
  {
    path: '/dashboard/therapy-tasks',
    label: 'Therapy Tasks',
    section: 'admin',
    icon: 'Assignment',
  },
  {
    path: '/dashboard/admin/users',
    label: 'User Management',
    section: 'admin',
    icon: 'AdminPanelSettings',
  },

  // Lookup Tables (for database sync - displayed in nested submenu)
  {
    path: '/dashboard/bodies',
    label: 'Bodies',
    section: 'admin',
    icon: 'PeopleAlt',
  },
  {
    path: '/dashboard/buckets',
    label: 'Buckets',
    section: 'admin',
    icon: 'Inventory2',
  },
  {
    path: '/dashboard/financing-types',
    label: 'Financing Types',
    section: 'admin',
    icon: 'AccountBalance',
  },
  {
    path: '/dashboard/status',
    label: 'Lead Status',
    section: 'admin',
    icon: 'VerifiedUser',
  },
  {
    path: '/dashboard/payment-methods',
    label: 'Pay Methods',
    section: 'admin',
    icon: 'Payment',
  },
  {
    path: '/dashboard/payment-status',
    label: 'Pay Status',
    section: 'admin',
    icon: 'CheckCircle',
  },
  {
    path: '/dashboard/pillars',
    label: 'Pillars',
    section: 'admin',
    icon: 'AccountTree',
  },
  {
    path: '/dashboard/program-status',
    label: 'Program Status',
    section: 'admin',
    icon: 'AssignmentTurnedIn',
  },
  {
    path: '/dashboard/rasha-list',
    label: 'RASHA',
    section: 'admin',
    icon: 'List',
  },
  {
    path: '/dashboard/therapy-type',
    label: 'Therapy Types',
    section: 'admin',
    icon: 'LocalHospital',
  },
  {
    path: '/dashboard/vendors',
    label: 'Vendors',
    section: 'admin',
    icon: 'Store',
  },
];

// Helper function to get menu items by section
export function getMenuItemsBySection(
  section: MenuItem['section']
): MenuItem[] {
  return MENU_ITEMS.filter(item => item.section === section);
}

// Helper function to get all menu paths
export function getAllMenuPaths(): string[] {
  return MENU_ITEMS.map(item => item.path);
}

// Helper function to find menu item by path
export function findMenuItemByPath(path: string): MenuItem | undefined {
  return MENU_ITEMS.find(item => item.path === path);
}
