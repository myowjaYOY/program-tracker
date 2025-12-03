'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Collapse,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  BarChart as ReportsIcon,
  AssignmentTurnedIn as CoordinatorIcon,
  Event as EventsIcon,
  GroupAdd as LeadsIcon,
  School as ProgramsIcon,
  Description as DocumentsIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  ExpandLess,
  ExpandMore,
  PeopleAlt as BodiesIcon,
  Inventory2 as BucketsIcon,
  AccountTree as PillarsIcon,
  AssignmentTurnedIn as ProgramStatusIcon,
  LocalHospital as TherapiesIcon,
  Store as VendorsIcon,
  VerifiedUser as MemberStatusIcon,
  History as AuditIcon,
  Assignment as TherapyTaskIcon,
  AccountBalance as FinancingTypesIcon,
  Payment as PaymentMethodsIcon,
  CheckCircle as PaymentStatusIcon,
  FactCheck as FactCheckIcon,
  Inventory as ItemRequestsIcon,
  ShoppingCart as OrderItemsIcon,
  Assessment as InventoryForecastIcon,
  List as ListIcon,
  Badge as ProgramRolesIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useUserPermissions } from '@/lib/hooks/use-user-permissions';
import Logo from '@/components/icons/Logo';

interface SidebarProps {
  user: User;
}

const mainNav = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  {
    label: 'Coordinator',
    icon: <CoordinatorIcon />,
    path: '/dashboard/coordinator',
  },
  {
    label: 'Order Items',
    icon: <OrderItemsIcon />,
    path: '/dashboard/order-items',
  },
  {
    label: 'Report Card',
    icon: <InventoryForecastIcon />,
    path: '/dashboard/report-card',
  },
];

const marketingNav = [
  { label: 'Campaigns', icon: <EventsIcon />, path: '/dashboard/campaigns' },
  { label: 'Leads', icon: <LeadsIcon />, path: '/dashboard/leads' },
  { label: 'Reports', icon: <ReportsIcon />, path: '/dashboard/reports' },
];

const salesNav = [
  { label: 'Programs', icon: <ProgramsIcon />, path: '/dashboard/programs' },
  { label: 'Reports', icon: <ReportsIcon />, path: '/dashboard/sales/reports' },
];

const operationsNav = [
  {
    label: 'Inventory Forecast',
    icon: <InventoryForecastIcon />,
    path: '/dashboard/inventory-forecast',
  },
  {
    label: 'Inventory Management',
    icon: <ItemRequestsIcon />,
    path: '/dashboard/inventory-management',
  },
  {
    label: 'Item Requests',
    icon: <ItemRequestsIcon />,
    path: '/dashboard/item-requests',
  },
  {
    label: 'Program Analytics',
    icon: <ReportsIcon />,
    path: '/dashboard/program-analytics',
  },
];

// Admin navigation with nested Lookup submenu
const adminNav = [
  {
    label: 'Audit Report',
    icon: <AuditIcon />,
    path: '/dashboard/audit-report',
  },
  {
    label: 'Dashboard Analytics',
    icon: <DashboardIcon />,
    path: '/dashboard/admin/analytics',
  },
  {
    label: 'Payments',
    icon: <PaymentMethodsIcon />,
    path: '/dashboard/payments',
  },
  {
    label: 'Program Audit',
    icon: <FactCheckIcon />,
    path: '/dashboard/admin/program-audit',
  },
  {
    label: 'Program Templates',
    icon: <DocumentsIcon />,
    path: '/dashboard/admin/program-templates',
  },
  {
    label: 'System Jobs',
    icon: <ScheduleIcon />,
    path: '/dashboard/admin/system-jobs',
  },
  { label: 'Therapies', icon: <TherapiesIcon />, path: '/dashboard/therapies' },
  {
    label: 'Therapy Tasks',
    icon: <TherapyTaskIcon />,
    path: '/dashboard/therapy-tasks',
  },
  {
    label: 'User Management',
    icon: <AdminIcon />,
    path: '/dashboard/admin/users',
  },
  {
    label: 'Lookup',
    icon: <AdminIcon />,
    path: null, // No direct path, this is a submenu
    submenu: [
      { label: 'Bodies', icon: <BodiesIcon />, path: '/dashboard/bodies' },
      { label: 'Buckets', icon: <BucketsIcon />, path: '/dashboard/buckets' },
      {
        label: 'Financing Types',
        icon: <FinancingTypesIcon />,
        path: '/dashboard/financing-types',
      },
      {
        label: 'Lead Status',
        icon: <MemberStatusIcon />,
        path: '/dashboard/status',
      },
      {
        label: 'Pay Methods',
        icon: <PaymentMethodsIcon />,
        path: '/dashboard/payment-methods',
      },
      {
        label: 'Pay Status',
        icon: <PaymentStatusIcon />,
        path: '/dashboard/payment-status',
      },
      { label: 'Pillars', icon: <PillarsIcon />, path: '/dashboard/pillars' },
      {
        label: 'Program Roles',
        icon: <ProgramRolesIcon />,
        path: '/dashboard/program-roles',
      },
      {
        label: 'Program Status',
        icon: <ProgramStatusIcon />,
        path: '/dashboard/program-status',
      },
      { label: 'RASHA', icon: <ListIcon />, path: '/dashboard/rasha-list' },
      {
        label: 'Therapy Types',
        icon: <TherapiesIcon />,
        path: '/dashboard/therapy-type',
      },
      { label: 'Vendors', icon: <VendorsIcon />, path: '/dashboard/vendors' },
    ],
  },
];

export default function Sidebar({ user }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [openSection, setOpenSection] = useState<string | undefined>(undefined);
  const [openSubmenu, setOpenSubmenu] = useState<string | undefined>(undefined);

  // Get user permissions
  const { data: userPermissions, isLoading: permissionsLoading } =
    useUserPermissions();

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <Box
        sx={{
          width: { xs: '100%', md: 240 },
          height: '100vh',
          borderRight: { xs: 0, md: 1 },
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          position: { xs: 'relative', md: 'fixed' },
          left: 0,
          top: 0,
          zIndex: theme => theme.zIndex.drawer,
          boxShadow: { xs: 'none', md: '0 1px 8px rgba(0,0,0,0.03)' },
        }}
      >
        {/* Logo */}
        <Box
          sx={{ p: 2, pt: 2, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Logo />
          <Typography
            variant="h6"
            fontWeight={700}
            color="primary.main"
            sx={{ ml: 1, fontSize: 18 }}
          >
            Program Tracker
          </Typography>
        </Box>

        {/* Loading State */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Loading permissions...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Filter navigation based on permissions
  const getFilteredNavigation = () => {
    if (!userPermissions || permissionsLoading) {
      return { main: [], marketing: [], sales: [], operations: [], admin: [] };
    }

    const { isAdmin, permissions } = userPermissions;

    // Filter based on user permissions
    const hasPermission = (path: string) =>
      isAdmin || permissions.includes('*') || permissions.includes(path);

    // Filter admin nav including submenu items
    const filteredAdminNav = adminNav
      .map(item => {
        if (item.submenu) {
          // Filter submenu items based on permissions
          const filteredSubmenu = item.submenu.filter(subItem =>
            hasPermission(subItem.path)
          );
          return { ...item, submenu: filteredSubmenu };
        }
        return item;
      })
      .filter(item => {
        // Show item if it has a path and user has permission, or if it's a submenu with visible items
        return (
          (item.path && hasPermission(item.path)) ||
          (item.submenu && item.submenu.length > 0)
        );
      });

    return {
      main: mainNav.filter(item => hasPermission(item.path)),
      marketing: marketingNav.filter(item => hasPermission(item.path)),
      sales: salesNav.filter(item => hasPermission(item.path)),
      operations: operationsNav.filter(item => hasPermission(item.path)),
      admin: filteredAdminNav,
    };
  };

  const filteredNav = getFilteredNavigation();

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
    handleUserMenuClose();
  };

  return (
    <Box
      sx={{
        width: { xs: '100%', md: 240 },
        height: '100vh',
        borderRight: { xs: 0, md: 1 },
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        position: { xs: 'relative', md: 'fixed' },
        left: 0,
        top: 0,
        zIndex: theme => theme.zIndex.drawer,
        boxShadow: { xs: 'none', md: '0 1px 8px rgba(0,0,0,0.03)' },
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 2, pt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Logo />
        <Typography
          variant="h6"
          fontWeight={700}
          color="primary.main"
          sx={{ ml: 1, fontSize: 18 }}
        >
          Program Tracker
        </Typography>
      </Box>
      {/* Scrollable Menu Section */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Main Nav */}
        <List sx={{ pt: 0 }}>
          {filteredNav.main.map(item => (
            <ListItem disablePadding key={item.label}>
              <ListItemButton
                selected={pathname === item.path}
                onClick={() => router.push(item.path)}
                sx={{
                  // Use theme default borderRadius
                  mx: 1,
                  my: 0.5,
                  color:
                    pathname === item.path ? 'primary.main' : 'text.primary',
                  backgroundColor:
                    pathname === item.path ? '#f5f2ff' : 'transparent',
                  '&:hover': {
                    backgroundColor: '#f5f2ff',
                  },
                  transition: 'all 0.15s',
                }}
              >
                <ListItemIcon
                  sx={{
                    color:
                      pathname === item.path
                        ? 'primary.main'
                        : 'text.secondary',
                    minWidth: 36,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        {/* Marketing Section (Collapsible) */}
        {filteredNav.marketing.length > 0 && (
          <ListSubheader
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: 13,
              mt: 2,
              mb: 0.5,
              pl: 2,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() =>
              setOpenSection(
                openSection === 'marketing' ? undefined : 'marketing'
              )
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ flex: 1 }}>Marketing</Box>
              {openSection === 'marketing' ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
            </Box>
          </ListSubheader>
        )}
        <Collapse in={openSection === 'marketing'} timeout="auto" unmountOnExit>
          <List sx={{ pt: 0 }}>
            {filteredNav.marketing.map(item => (
              <ListItem disablePadding key={item.label}>
                <ListItemButton
                  selected={pathname === item.path}
                  onClick={() => router.push(item.path)}
                  sx={{
                    // Use theme default borderRadius
                    mx: 1,
                    my: 0.5,
                    color:
                      pathname === item.path ? 'primary.main' : 'text.primary',
                    backgroundColor:
                      pathname === item.path ? '#f5f2ff' : 'transparent',
                    '&:hover': {
                      backgroundColor: '#f5f2ff',
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        pathname === item.path
                          ? 'primary.main'
                          : 'text.secondary',
                      minWidth: 36,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
        {/* Operations Section (Collapsible) */}
        {filteredNav.operations.length > 0 && (
          <ListSubheader
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: 13,
              mt: 2,
              mb: 0.5,
              pl: 2,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() =>
              setOpenSection(openSection === 'operations' ? undefined : 'operations')
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ flex: 1 }}>Operations</Box>
              {openSection === 'operations' ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
            </Box>
          </ListSubheader>
        )}
        <Collapse in={openSection === 'operations'} timeout="auto" unmountOnExit>
          <List sx={{ pt: 0 }}>
            {filteredNav.operations.map(item => (
              <ListItem disablePadding key={item.label}>
                <ListItemButton
                  selected={pathname === item.path}
                  onClick={() => router.push(item.path)}
                  sx={{
                    // Use theme default borderRadius
                    mx: 1,
                    my: 0.5,
                    color:
                      pathname === item.path ? 'primary.main' : 'text.primary',
                    backgroundColor:
                      pathname === item.path ? '#f5f2ff' : 'transparent',
                    '&:hover': {
                      backgroundColor: '#f5f2ff',
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        pathname === item.path
                          ? 'primary.main'
                          : 'text.secondary',
                      minWidth: 36,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
        {/* Sales Section (Collapsible) */}
        {filteredNav.sales.length > 0 && (
          <ListSubheader
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: 13,
              mt: 2,
              mb: 0.5,
              pl: 2,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() =>
              setOpenSection(openSection === 'sales' ? undefined : 'sales')
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ flex: 1 }}>Sales</Box>
              {openSection === 'sales' ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
            </Box>
          </ListSubheader>
        )}
        <Collapse in={openSection === 'sales'} timeout="auto" unmountOnExit>
          <List sx={{ pt: 0 }}>
            {filteredNav.sales.map(item => (
              <ListItem disablePadding key={item.label}>
                <ListItemButton
                  selected={pathname === item.path}
                  onClick={() => router.push(item.path)}
                  sx={{
                    // Use theme default borderRadius
                    mx: 1,
                    my: 0.5,
                    color:
                      pathname === item.path ? 'primary.main' : 'text.primary',
                    backgroundColor:
                      pathname === item.path ? '#f5f2ff' : 'transparent',
                    '&:hover': {
                      backgroundColor: '#f5f2ff',
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        pathname === item.path
                          ? 'primary.main'
                          : 'text.secondary',
                      minWidth: 36,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
        {/* Admin Section (Collapsible) */}
        {filteredNav.admin.length > 0 && (
          <ListSubheader
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: 13,
              mt: 2,
              mb: 0.5,
              pl: 2,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() =>
              setOpenSection(openSection === 'admin' ? undefined : 'admin')
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ flex: 1 }}>Admin</Box>
              {openSection === 'admin' ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
            </Box>
          </ListSubheader>
        )}
        <Collapse in={openSection === 'admin'} timeout="auto" unmountOnExit>
          <List sx={{ pt: 0 }}>
            {filteredNav.admin.map(item => (
              <React.Fragment key={item.label}>
                {item.submenu ? (
                  // Submenu item (like Lookup)
                  (<ListItem disablePadding>
                    <ListItemButton
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenSubmenu(
                          openSubmenu === item.label.toLowerCase()
                            ? undefined
                            : item.label.toLowerCase()
                        );
                      }}
                      sx={{
                        mx: 1,
                        my: 0.5,
                        color: 'text.primary',
                        backgroundColor: 'transparent',
                        '&:hover': {
                          backgroundColor: '#f5f2ff',
                        },
                        transition: 'all 0.15s',
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color: 'text.secondary',
                          minWidth: 36,
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontWeight: 500,
                          fontSize: 15,
                        }}
                      />
                      {openSubmenu === item.label.toLowerCase() ? (
                        <ExpandLess fontSize="small" />
                      ) : (
                        <ExpandMore fontSize="small" />
                      )}
                    </ListItemButton>
                  </ListItem>)
                ) : (
                  // Regular menu item
                  (<ListItem disablePadding>
                    <ListItemButton
                      selected={pathname === item.path}
                      onClick={() => router.push(item.path)}
                      sx={{
                        mx: 1,
                        my: 0.5,
                        color:
                          pathname === item.path
                            ? 'primary.main'
                            : 'text.primary',
                        backgroundColor:
                          pathname === item.path ? '#f5f2ff' : 'transparent',
                        '&:hover': {
                          backgroundColor: '#f5f2ff',
                        },
                        transition: 'all 0.15s',
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color:
                            pathname === item.path
                              ? 'primary.main'
                              : 'text.secondary',
                          minWidth: 36,
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontWeight: 500,
                          fontSize: 15,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>)
                )}

                {/* Render submenu items if this is a submenu */}
                {item.submenu && (
                  <Collapse
                    in={openSubmenu === item.label.toLowerCase()}
                    timeout="auto"
                    unmountOnExit
                  >
                    <List sx={{ pl: 4, pt: 0 }}>
                      {item.submenu.map(subItem => (
                        <ListItem disablePadding key={subItem.label}>
                          <ListItemButton
                            selected={pathname === subItem.path}
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(subItem.path);
                            }}
                            sx={{
                              mx: 1,
                              my: 0.5,
                              color:
                                pathname === subItem.path
                                  ? 'primary.main'
                                  : 'text.primary',
                              backgroundColor:
                                pathname === subItem.path
                                  ? '#f5f2ff'
                                  : 'transparent',
                              '&:hover': {
                                backgroundColor: '#f5f2ff',
                              },
                              transition: 'all 0.15s',
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                color:
                                  pathname === subItem.path
                                    ? 'primary.main'
                                    : 'text.secondary',
                                minWidth: 36,
                              }}
                            >
                              {subItem.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={subItem.label}
                              primaryTypographyProps={{
                                fontWeight: 500,
                                fontSize: 14,
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </React.Fragment>
            ))}
          </List>
        </Collapse>
      </Box>
      {/* User Section */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Avatar
          sx={{
            width: 36,
            height: 36,
            fontSize: '1rem',
            backgroundColor: 'primary.main',
            color: 'white',
            fontWeight: 700,
          }}
        >
          {user.email?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={600} fontSize={15} color="text.primary">
            {user.email?.split('@')[0] || 'User'}
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            {userPermissions?.isAdmin ? 'ADMIN' : 'USER'}
          </Typography>
        </Box>
        <IconButton onClick={handleUserMenuClick}>
          <LogoutIcon sx={{ color: 'text.secondary' }} />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleUserMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          PaperProps={{ sx: { mt: 1, minWidth: 200, borderRadius: 2 } }}
        >
          <MenuItem disabled sx={{ opacity: 0.7 }}>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
            <Typography variant="body2">Logout</Typography>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
