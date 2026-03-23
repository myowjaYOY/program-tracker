'use client';

import React, { Suspense } from 'react';
import { Box, Skeleton } from '@mui/material';
import UserTable from '@/components/users/user-table';
import { useSyncMenuItems } from '@/lib/hooks/use-admin';

function UserTableSkeleton() {
  return (
    <Box sx={{ width: '100%', height: '100%' }}>
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
      <Box sx={{ height: 600, width: '100%' }}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </Box>
    </Box>
  );
}

function UserManagementContent() {
  const syncMenuItemsMutation = useSyncMenuItems();

  const handleSyncMenuItems = async () => {
    try {
      await syncMenuItemsMutation.mutateAsync();
    } catch (error) {
      console.error('Error syncing menu items:', error);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', width: '100%' }}>
      <Suspense fallback={<UserTableSkeleton />}>
        <UserTable
          syncMenuItemsProps={{
            onSync: handleSyncMenuItems,
            isPending: syncMenuItemsMutation.isPending,
          }}
        />
      </Suspense>
    </Box>
  );
}

export default function UsersPage() {
  return <UserManagementContent />;
}
