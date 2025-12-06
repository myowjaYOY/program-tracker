'use client';

import { Box } from '@mui/material';
import { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import { NotificationBell } from '@/components/notifications';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

export default function DashboardLayout({
  children,
  user,
}: DashboardLayoutProps) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Sidebar user={user} />
      <Box
        component="main"
        sx={{
          flex: 1,
          marginLeft: { xs: 0, md: '240px' }, // Responsive margin
          backgroundColor: '#f8f9fa',
          minHeight: '100vh',
          width: '100%',
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
      {/* Floating notification bell - appears when there are active notifications */}
      <NotificationBell floating />
    </Box>
  );
}
