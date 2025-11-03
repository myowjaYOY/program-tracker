'use client';

import { useState, useMemo, useCallback } from 'react';
import { GridColDef } from '@mui/x-data-grid-pro';
import { Typography, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BaseDataTable from '@/components/tables/base-data-table';
import { usePurchaseOrders, useApprovePurchaseOrder, useOrderPurchaseOrder } from '@/lib/hooks/use-purchase-orders';
import { useUserPermissions } from '@/lib/hooks/use-user-permissions';
import { getUserDisplayName } from '@/lib/utils/item-request-status';
import AuditHistoryDialog from '@/components/audit/audit-history-dialog';
import CreatePOModal from './create-po-modal';
import ReceivePOModal from './receive-po-modal';

// Helper functions outside component to prevent re-creating columns
const getStatusColor = (status: string): 'default' | 'warning' | 'info' | 'secondary' | 'success' | 'error' | 'primary' => {
  switch (status) {
    case 'draft':
      return 'default';
    case 'pending_approval':
      return 'warning';
    case 'approved':
      return 'info';
    case 'ordered':
      return 'secondary';
    case 'partially_received':
      return 'primary'; // Will be customized to yellow in the render
    case 'received':
      return 'success';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface PurchaseOrder {
  po_id: number;
  po_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  subtotal_cost: number;
  tax_amount: number;
  shipping_cost: number;
  total_cost: number;
  notes: string | null;
  created_by_email: string | null;
  created_by_full_name: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  total_ordered: number;
  total_received: number;
}

interface PurchaseOrderWithItems extends PurchaseOrder {
  purchase_order_items: Array<{
    po_item_id: number;
    po_id: number;
    therapy_id: number;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
    line_total: number;
    received_date: string | null;
    active_flag: boolean;
    created_at: string;
    updated_at: string;
    therapy: {
      therapy_name: string;
      therapy_type: {
        therapy_type_name: string;
      };
    };
  }>;
}

export default function PurchaseOrderTable() {
  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders();
  const { data: permissions } = useUserPermissions();
  const approvePO = useApprovePurchaseOrder();
  const orderPO = useOrderPurchaseOrder();
  const [selectedPO, setSelectedPO] = useState<{ id: number; number: string } | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editPO, setEditPO] = useState<PurchaseOrderWithItems | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [poToApprove, setPoToApprove] = useState<{ id: number; number: string } | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [poToOrder, setPoToOrder] = useState<{ id: number; number: string } | null>(null);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [poToReceive, setPoToReceive] = useState<PurchaseOrderWithItems | null>(null);

  const isAdmin = permissions?.isAdmin || false;

  const handleViewHistory = useCallback((poId: number, poNumber: string) => {
    setSelectedPO({ id: poId, number: poNumber });
    setHistoryModalOpen(true);
  }, []);

  const handleEdit = useCallback(async (poId: number) => {
    // Fetch the full PO with items from the detail endpoint
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setEditPO(json.data);
        setEditModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching PO details:', error);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setHistoryModalOpen(false);
    setSelectedPO(null);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditPO(null);
  }, []);

  const handleApproveClick = useCallback((poId: number, poNumber: string) => {
    setPoToApprove({ id: poId, number: poNumber });
    setApproveDialogOpen(true);
  }, []);

  const handleApproveConfirm = useCallback(() => {
    if (poToApprove) {
      approvePO.mutate(poToApprove.id);
      setApproveDialogOpen(false);
      setPoToApprove(null);
    }
  }, [poToApprove, approvePO]);

  const handleApproveCancel = useCallback(() => {
    setApproveDialogOpen(false);
    setPoToApprove(null);
  }, []);

  const handleOrderClick = useCallback((poId: number, poNumber: string) => {
    setPoToOrder({ id: poId, number: poNumber });
    setOrderDialogOpen(true);
  }, []);

  const handleOrderConfirm = useCallback(() => {
    if (poToOrder) {
      orderPO.mutate(poToOrder.id);
      setOrderDialogOpen(false);
      setPoToOrder(null);
    }
  }, [poToOrder, orderPO]);

  const handleOrderCancel = useCallback(() => {
    setOrderDialogOpen(false);
    setPoToOrder(null);
  }, []);

  const handleReceiveClick = useCallback(async (poId: number) => {
    // Fetch the full PO with items from the detail endpoint
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setPoToReceive(json.data);
        setReceiveModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching PO details:', error);
    }
  }, []);

  const handleCloseReceiveModal = useCallback(() => {
    setReceiveModalOpen(false);
    setPoToReceive(null);
  }, []);

  const getRowId = useCallback((row: any) => row.po_id, []);

  // Transform data for grid with calculated fields
  const rows = useMemo(() => {
    return purchaseOrders.map(po => {
      const receivedStatus = po.item_count > 0 ? `${po.total_received}/${po.total_ordered}` : '-';

      return {
        id: po.po_id,
        po_id: po.po_id,
        po_number: po.po_number,
        order_date: po.order_date,
        expected_delivery_date: po.expected_delivery_date,
        status: po.status,
        subtotal_cost: po.subtotal_cost,
        tax_amount: po.tax_amount,
        shipping_cost: po.shipping_cost,
        total_cost: po.total_cost,
        created_by_email: po.created_by_email,
        created_by_full_name: po.created_by_full_name,
        item_count: po.item_count,
        received_status: receivedStatus,
      };
    });
  }, [purchaseOrders]);

  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'history',
      headerName: 'History',
      width: 90,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: any) => (
        <IconButton
          size="small"
          onClick={() => handleViewHistory(params.row.po_id, params.row.po_number)}
          sx={{ color: 'primary.main' }}
        >
          <HistoryIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: 'po_number',
      headerName: 'PO Number',
      width: 180,
      renderCell: (params: any) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'order_date',
      headerName: 'Order Date',
      width: 130,
      renderCell: (params: any) => {
        if (!params.value) return <Typography variant="body2">-</Typography>;
        const date = new Date(params.value);
        return (
          <Typography variant="body2">
            {date.toLocaleDateString()}
          </Typography>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 170,
      renderCell: (params: any) => {
        const isPartiallyReceived = params.value === 'partially_received';
        return (
          <Chip
            label={getStatusLabel(params.value)}
            color={getStatusColor(params.value)}
            size="small"
            sx={{ 
              borderRadius: 0, 
              fontWeight: 600,
              ...(isPartiallyReceived && {
                backgroundColor: '#FDD835',
                color: '#000',
                '&:hover': {
                  backgroundColor: '#FBC02D',
                },
              }),
            }}
          />
        );
      },
    },
    {
      field: 'expected_delivery_date',
      headerName: 'Expected Delivery',
      width: 150,
      renderCell: (params: any) => {
        if (!params.value) return <Typography variant="body2">-</Typography>;
        const date = new Date(params.value);
        return (
          <Typography variant="body2">
            {date.toLocaleDateString()}
          </Typography>
        );
      },
    },
    {
      field: 'tax_amount',
      headerName: 'Tax',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: any) => (
        <Typography variant="body2">
          ${params.value?.toFixed(2) || '0.00'}
        </Typography>
      ),
    },
    {
      field: 'shipping_cost',
      headerName: 'Shipping',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: any) => (
        <Typography variant="body2">
          ${params.value?.toFixed(2) || '0.00'}
        </Typography>
      ),
    },
    {
      field: 'total_cost',
      headerName: 'Total Cost',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: any) => (
        <Typography variant="body2">
          ${params.value?.toFixed(2) || '0.00'}
        </Typography>
      ),
    },
    {
      field: 'item_count',
      headerName: 'Items',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: any) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'received_status',
      headerName: 'Received',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: any) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'created_by_full_name',
      headerName: 'Created By',
      width: 180,
      renderCell: (params: any) => (
        <Typography variant="body2">
          {getUserDisplayName(
            params.row.created_by_full_name,
            params.row.created_by_email
          )}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: any) => {
        const canEdit = params.row.status === 'draft' || params.row.status === 'pending_approval';
        const canApprove = isAdmin && params.row.status === 'pending_approval';
        const canOrder = params.row.status === 'approved';
        const canReceive = params.row.status === 'ordered' || params.row.status === 'partially_received';
        
        return (
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
            <IconButton
              size="small"
              onClick={() => handleEdit(params.row.po_id)}
              disabled={!canEdit}
              sx={{ color: canEdit ? 'primary.main' : 'action.disabled' }}
              title={canEdit ? 'Edit' : 'Cannot edit this PO'}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleApproveClick(params.row.po_id, params.row.po_number)}
              disabled={!canApprove}
              sx={{ color: canApprove ? 'success.main' : 'action.disabled' }}
              title={canApprove ? 'Approve' : (!isAdmin ? 'Admin only' : 'Cannot approve this PO')}
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleOrderClick(params.row.po_id, params.row.po_number)}
              disabled={!canOrder}
              sx={{ color: canOrder ? 'info.main' : 'action.disabled' }}
              title={canOrder ? 'Mark as Ordered' : 'Cannot order this PO'}
            >
              <ShoppingCartIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleReceiveClick(params.row.po_id)}
              disabled={!canReceive}
              sx={{ color: canReceive ? 'warning.main' : 'action.disabled' }}
              title={canReceive ? 'Receive Items' : 'Cannot receive this PO'}
            >
              <LocalShippingIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      },
    },
  ], [handleViewHistory, handleEdit, handleApproveClick, handleOrderClick, handleReceiveClick, isAdmin]);

  return (
    <>
      <BaseDataTable<any>
        title=""
        data={rows}
        columns={columns}
        loading={isLoading}
        getRowId={getRowId}
        showCreateButton={false}
        showActionsColumn={false}
      />
      
      {/* Edit PO Modal */}
      {editPO && (
        <CreatePOModal
          open={editModalOpen}
          onClose={handleCloseEditModal}
          existingPO={editPO}
          onSuccess={handleCloseEditModal}
        />
      )}

      {/* Audit History Modal */}
      {selectedPO && (
        <AuditHistoryDialog
          open={historyModalOpen}
          onClose={handleCloseModal}
          tableName="purchase_orders"
          recordId={selectedPO.id.toString()}
          recordTitle={`Purchase Order ${selectedPO.number}`}
        />
      )}

      {/* Approve Confirmation Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={handleApproveCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Purchase Order</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to approve <strong>{poToApprove?.number}</strong>?
          </Typography>
          <Typography sx={{ mt: 2 }}>
            Once approved, the purchase order status will change to "Approved" and can proceed to ordering.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleApproveCancel} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleApproveConfirm}
            variant="contained"
            color="success"
            autoFocus
            disabled={approvePO.isPending}
          >
            {approvePO.isPending ? 'Approving...' : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Confirmation Dialog */}
      <Dialog
        open={orderDialogOpen}
        onClose={handleOrderCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mark Purchase Order as Ordered</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to mark <strong>{poToOrder?.number}</strong> as ordered?
          </Typography>
          <Typography sx={{ mt: 2 }}>
            This indicates that the purchase order has been sent to the supplier and is awaiting delivery.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOrderCancel} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleOrderConfirm}
            variant="contained"
            color="info"
            autoFocus
            disabled={orderPO.isPending}
          >
            {orderPO.isPending ? 'Processing...' : 'Mark as Ordered'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receive PO Modal */}
      {poToReceive && (
        <ReceivePOModal
          open={receiveModalOpen}
          onClose={handleCloseReceiveModal}
          poData={poToReceive}
          onSuccess={handleCloseReceiveModal}
        />
      )}
    </>
  );
}
