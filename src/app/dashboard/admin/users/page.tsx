'use client';

import React, { Suspense } from 'react';
import { Box, Skeleton, Button, CircularProgress } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import UserTable from '@/components/users/user-table';
import { useSyncMenuItems } from '@/lib/hooks/use-admin';

// Loading skeleton component
function UserTableSkeleton() {
  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      {/* Header skeleton */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton
          variant="rectangular"
          width={120}
          height={40}
          sx={{ borderRadius: 2 }}
        />
      </Box>

      {/* Table skeleton */}
      <Box sx={{ height: 600, width: '100%' }}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </Box>
    </Box>
  );
}

function UserManagementContent() {
  const syncMenuItemsMutation = useSyncMenuItems();
  const [isClearing, setIsClearing] = React.useState(false);

  const handleSyncMenuItems = async () => {
    try {
      const result = await syncMenuItemsMutation.mutateAsync();
      console.log(`Synced ${result.synced} menu items (${result.new} new)`);
    } catch (error) {
      console.error('Error syncing menu items:', error);
    }
  };

  const handleClearMenuItems = async () => {
    try {
      setIsClearing(true);
      const response = await fetch('/api/admin/clear-menu-items', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear menu items');
      }
      
      const data = await response.json();
      console.log('Menu items cleared:', data.message);
      alert('Menu items table cleared successfully!');
    } catch (error) {
      console.error('Error clearing menu items:', error);
      alert('Error clearing menu items');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
      <Suspense fallback={<UserTableSkeleton />}>
        <UserTable 
          syncMenuItemsProps={{
            onSync: handleSyncMenuItems,
            isPending: syncMenuItemsMutation.isPending
          }}
          clearMenuItemsProps={{
            onClear: handleClearMenuItems,
            isPending: isClearing
          }}
        />
      </Suspense>
    </Box>
  );
}

export default function UsersPage() {
  return <UserManagementContent />;
}
