'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import BaseDataTable, { renderCurrency } from '@/components/tables/base-data-table';
import { useReceivePurchaseOrder, type ReceiveItem } from '@/lib/hooks/use-purchase-orders';

interface POItemWithReceiving {
  id: number; // Alias for po_item_id to satisfy BaseEntity
  po_item_id: number;
  therapy_id: number;
  therapy_name: string;
  therapy_type_name: string;
  unit_cost: number;
  quantity_ordered: number;
  quantity_received: number;
  quantity_remaining: number;
  quantity_receiving: number;
}

interface ReceivePOData {
  po_id: number;
  po_number: string;
  status: string;
  purchase_order_items: Array<{
    po_item_id: number;
    therapy_id: number;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
    therapy: {
      therapy_name: string;
      therapy_type: {
        therapy_type_name: string;
      };
    };
  }>;
}

interface ReceivePOModalProps {
  open: boolean;
  onClose: () => void;
  poData: ReceivePOData | null;
  onSuccess?: () => void;
}

export default function ReceivePOModal({
  open,
  onClose,
  poData,
  onSuccess,
}: ReceivePOModalProps) {
  const [receivingQuantities, setReceivingQuantities] = useState<Record<number, number>>({});
  const receivePO = useReceivePurchaseOrder();

  // Transform PO items to include calculated fields
  const items: POItemWithReceiving[] = useMemo(() => {
    if (!poData) return [];
    
    return poData.purchase_order_items.map(item => ({
      id: item.po_item_id, // Add id field for BaseDataTable
      po_item_id: item.po_item_id,
      therapy_id: item.therapy_id,
      therapy_name: item.therapy.therapy_name,
      therapy_type_name: item.therapy.therapy_type.therapy_type_name,
      unit_cost: item.unit_cost,
      quantity_ordered: item.quantity_ordered,
      quantity_received: item.quantity_received,
      quantity_remaining: item.quantity_ordered - item.quantity_received,
      quantity_receiving: receivingQuantities[item.po_item_id] || 0,
    }));
  }, [poData, receivingQuantities]);

  // Handle quantity change
  const handleQuantityChange = (po_item_id: number, value: number) => {
    const item = items.find(i => i.po_item_id === po_item_id);
    if (!item) return;

    // Ensure value doesn't exceed remaining quantity
    const validValue = Math.max(0, Math.min(value, item.quantity_remaining));
    
    setReceivingQuantities(prev => ({
      ...prev,
      [po_item_id]: validValue,
    }));
  };

  // Handle receive items
  const handleReceive = () => {
    if (!poData) return;

    const itemsToReceive: ReceiveItem[] = items
      .filter(item => item.quantity_receiving > 0)
      .map(item => ({
        po_item_id: item.po_item_id,
        quantity_receiving: item.quantity_receiving,
      }));

    if (itemsToReceive.length === 0) {
      return;
    }

    receivePO.mutate(
      { po_id: poData.po_id, items: itemsToReceive },
      {
        onSuccess: () => {
          setReceivingQuantities({});
          if (onSuccess) onSuccess();
          onClose();
        },
      }
    );
  };

  // Check if any items have receiving quantity > 0
  const hasItemsToReceive = items.some(item => item.quantity_receiving > 0);

  // Table columns
  const columns: GridColDef[] = [
    {
      field: 'therapy_name',
      headerName: 'Item',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={500}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'unit_cost',
      headerName: 'Unit Cost',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: renderCurrency,
    },
    {
      field: 'quantity_ordered',
      headerName: 'Qty Ordered',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">{params.value}</Typography>
      ),
    },
    {
      field: 'quantity_received',
      headerName: 'Already Received',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">{params.value}</Typography>
      ),
    },
    {
      field: 'quantity_remaining',
      headerName: 'Remaining',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'quantity_receiving',
      headerName: 'Receiving Now',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <TextField
          type="number"
          value={params.row.quantity_receiving}
          onChange={(e) => {
            const value = parseInt(e.target.value) || 0;
            handleQuantityChange(params.row.po_item_id, value);
          }}
          inputProps={{ 
            min: 0, 
            max: params.row.quantity_remaining,
            step: 1 
          }}
          size="small"
          variant="standard"
          disabled={params.row.quantity_remaining === 0}
          sx={{
            width: '100%',
            '& .MuiInput-root': {
              backgroundColor: 'white',
              '&:before': { borderBottom: 'none' },
              '&:after': { borderBottom: 'none' },
              '&:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
            },
            '& input': {
              textAlign: 'right',
              padding: '4px 8px',
            },
          }}
        />
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="span">
            Receive Items - {poData?.po_number}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <BaseDataTable
          title=""
          data={items}
          columns={columns}
          loading={false}
          showCreateButton={false}
          showActionsColumn={false}
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          onClick={handleReceive}
          variant="contained"
          color="primary"
          disabled={!hasItemsToReceive || receivePO.isPending}
          sx={{ borderRadius: 0, minWidth: 120 }}
        >
          {receivePO.isPending ? 'Receiving...' : 'Receive Items'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

