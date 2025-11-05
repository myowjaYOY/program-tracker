'use client';

import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useInventoryItems } from '@/lib/hooks/use-inventory-counts';
import { formatDistanceToNow } from 'date-fns';

export default function InventoryItemsTab() {
  const { data: items, isLoading, error } = useInventoryItems();

  const columns: GridColDef[] = [
    {
      field: 'therapy_name',
      headerName: 'Item Name',
      flex: 2,
      valueGetter: (_, row) => row.therapy?.therapy_name || 'N/A',
    },
    {
      field: 'therapy_type',
      headerName: 'Type',
      flex: 1,
      valueGetter: (_, row) =>
        row.therapy?.therapy_type?.therapy_type_name || 'N/A',
    },
    {
      field: 'quantity_on_hand',
      headerName: 'On Hand',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color:
              params.row.quantity_on_hand < params.row.reorder_point
                ? 'error.main'
                : 'text.primary',
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'reorder_point',
      headerName: 'Reorder Point',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'reorder_quantity',
      headerName: 'Reorder Qty',
      type: 'number',
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'cost',
      headerName: 'Cost',
      type: 'number',
      valueGetter: (_, row) => row.therapy?.cost || 0,
      renderCell: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'charge',
      headerName: 'Charge',
      type: 'number',
      valueGetter: (_, row) => row.therapy?.charge || 0,
      renderCell: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'last_counted_at',
      headerName: 'Last Counted',
      flex: 1,
      renderCell: (params) =>
        params.value
          ? formatDistanceToNow(new Date(params.value), { addSuffix: true })
          : 'Never',
    },
    {
      field: 'status',
      headerName: 'Status',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const isLowStock =
          params.row.quantity_on_hand < params.row.reorder_point;
        return (
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: isLowStock ? 'error.light' : 'success.light',
              color: isLowStock ? 'error.dark' : 'success.dark',
            }}
          >
            {isLowStock ? 'Low Stock' : 'In Stock'}
          </Box>
        );
      },
    },
  ];

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          Failed to load inventory items. Please try again.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {items?.length || 0} item(s) in inventory
      </Typography>

      <DataGrid
        rows={items || []}
        columns={columns}
        getRowId={(row) => row.inventory_item_id}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25, page: 0 },
          },
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        autoHeight
        sx={{
          border: 0,
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      />
    </Box>
  );
}

