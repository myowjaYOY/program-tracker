'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Autocomplete,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import BaseDataTable, { renderCurrency } from '@/components/tables/base-data-table';
import { useCreatePurchaseOrder, useUpdatePurchaseOrder } from '@/lib/hooks/use-purchase-orders';
import type { InventoryForecastRow } from '@/types/database.types';

interface ExistingPO {
  po_id: number;
  po_number: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  expected_delivery_date: string | null;
  tax_amount: number;
  shipping_cost: number;
  notes: string | null;
  purchase_order_items: Array<{
    po_item_id: number;
    therapy_id: number;
    quantity_ordered: number;
    unit_cost: number;
    therapy: {
      therapy_name: string;
      therapy_type: {
        therapy_type_name: string;
      };
    };
  }>;
}

// Extended type to include manually added items
interface POItem extends Partial<InventoryForecastRow> {
  id: string;
  therapy_id: number;
  therapy_name: string;
  therapy_type_name: string;
  current_cost: number;
  quantity_on_hand: number;
  isManuallyAdded?: boolean;
}

interface CreatePOModalProps {
  open: boolean;
  onClose: () => void;
  initialItems?: InventoryForecastRow[];
  existingPO?: ExistingPO | null;
  onSuccess?: () => void;
}

export default function CreatePOModal({
  open,
  onClose,
  initialItems = [],
  existingPO = null,
  onSuccess,
}: CreatePOModalProps) {
  const [items, setItems] = useState<POItem[]>([]);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [taxAmount, setTaxAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const autocompleteRef = useRef<HTMLInputElement>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isEditMode = !!existingPO;
  const createPurchaseOrder = useCreatePurchaseOrder();
  const updatePurchaseOrder = useUpdatePurchaseOrder();

  // Fetch inventory items for the dropdown
  useEffect(() => {
    if (open) {
      fetch('/api/inventory-items')
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            // Transform the nested data structure to flat structure
            const transformedItems = data.data.map((item: any) => ({
              therapy_id: item.therapy.therapy_id,
              therapy_name: item.therapy.therapy_name,
              therapy_type_name: item.therapy.therapy_type.therapy_type_name,
              current_cost: item.therapy.cost || 0,
              quantity_on_hand: item.quantity_on_hand || 0,
            }));
            // Sort alphabetically by therapy_name
            transformedItems.sort((a: any, b: any) => 
              a.therapy_name.localeCompare(b.therapy_name)
            );
            setInventoryItems(transformedItems);
          }
        })
        .catch(err => console.error('Error fetching inventory items:', err));
    }
  }, [open]);

  // Initialize items when modal opens - for existing PO (edit mode)
  const loadedPOIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset when modal closes
      loadedPOIdRef.current = null;
      return;
    }

    if (existingPO && loadedPOIdRef.current !== existingPO.po_id) {
      // Load existing PO data only if we haven't loaded this PO yet
      loadedPOIdRef.current = existingPO.po_id;
      
      const poItems: POItem[] = existingPO.purchase_order_items.map((item, index) => ({
        id: `existing-${item.po_item_id}`,
        therapy_id: item.therapy_id,
        therapy_name: item.therapy.therapy_name,
        therapy_type_name: item.therapy.therapy_type.therapy_type_name,
        current_cost: item.unit_cost,
        quantity_on_hand: 0, // We don't have this in the PO data
      }));
      setItems(poItems);

      // Initialize quantities from existing items
      const initialQuantities: Record<string, number> = {};
      existingPO.purchase_order_items.forEach((item) => {
        const itemId = `existing-${item.po_item_id}`;
        initialQuantities[itemId] = item.quantity_ordered;
      });
      setOrderQuantities(initialQuantities);

      // Set other PO fields
      setTaxAmount(existingPO.tax_amount || 0);
      setShippingCost(existingPO.shipping_cost || 0);
      setExpectedDeliveryDate(existingPO.expected_delivery_date);
      setOrderNotes(existingPO.notes || '');
    } else if (open && !existingPO && initialItems.length > 0 && items.length === 0) {
      // Load from inventory forecast selection (only if items not already loaded)
      const poItems: POItem[] = initialItems.map((item, index) => ({
        ...item,
        id: `${item.therapy_type_name}-${item.therapy_name}-${index}`,
      }));
      setItems(poItems);

      // Initialize quantities with owed_count - use same id format as items
      const initialQuantities: Record<string, number> = {};
      initialItems.forEach((item, index) => {
        const itemId = `${item.therapy_type_name}-${item.therapy_name}-${index}`;
        initialQuantities[itemId] = item.owed_count || 1;
      });
      setOrderQuantities(initialQuantities);
    } else if (open && !existingPO && initialItems.length === 0 && items.length > 0) {
      // Reset for manual creation (only if items are currently loaded)
      setItems([]);
      setOrderQuantities({});
      setTaxAmount(0);
      setShippingCost(0);
      setExpectedDeliveryDate(null);
      setOrderNotes('');
    }
  }, [open, existingPO, initialItems, items.length]);

  // Handle Add Item button
  const handleAddItem = () => {
    const newItemId = `new-item-${Date.now()}`;
    const newItem: POItem = {
      id: newItemId,
      therapy_id: 0, // Will be set when user selects from dropdown
      therapy_name: '',
      therapy_type_name: '',
      current_cost: 0,
      quantity_on_hand: 0,
      isManuallyAdded: true,
    };

    setItems(prev => [newItem, ...prev]);
    setEditingItemId(newItemId);
    setOrderQuantities(prev => ({ ...prev, [newItemId]: 1 }));

    // Focus the autocomplete after a short delay
    setTimeout(() => {
      if (autocompleteRef.current) {
        autocompleteRef.current.focus();
      }
    }, 100);
  };

  // Handle item selection from dropdown
  const handleItemSelect = (itemId: string, selectedInventoryItem: any) => {
    if (!selectedInventoryItem) return;

    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              therapy_id: selectedInventoryItem.therapy_id,
              therapy_name: selectedInventoryItem.therapy_name,
              therapy_type_name: selectedInventoryItem.therapy_type_name,
              current_cost: selectedInventoryItem.current_cost,
              quantity_on_hand: selectedInventoryItem.quantity_on_hand,
            }
          : item
      )
    );

    setEditingItemId(null);

    // Focus quantity input after item is selected
    setTimeout(() => {
      const quantityInput = quantityInputRefs.current[itemId];
      if (quantityInput) {
        quantityInput.focus();
        quantityInput.select(); // Select the text so user can immediately type
      }
    }, 100);
  };

  // Handle quantity changes
  const handleQuantityChange = (itemKey: string, quantity: number) => {
    setOrderQuantities(prev => ({
      ...prev,
      [itemKey]: quantity,
    }));
  };

  // Calculate total
  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => {
      const itemKey = item.id;
      const quantity = orderQuantities[itemKey] || 0;
      return sum + (item.current_cost || 0) * quantity;
    }, 0);
    return subtotal + taxAmount + shippingCost;
  };

  // Table data
  const tableData = useMemo(() => {
    return items.map(item => ({
      ...item,
      quantity: orderQuantities[item.id] || 0,
      total: (item.current_cost || 0) * (orderQuantities[item.id] || 0),
    }));
  }, [items, orderQuantities]);

  // Table columns
  const orderItemColumns: GridColDef[] = [
    {
      field: 'therapy_name',
      headerName: 'Item',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => {
        const isEditing = editingItemId === params.row.id;
        
        if (isEditing) {
          return (
            <Autocomplete
              ref={autocompleteRef}
              fullWidth
              size="small"
              options={inventoryItems}
              getOptionLabel={(option) => option.therapy_name}
              getOptionKey={(option) => option.therapy_id}
              onChange={(_, value) => handleItemSelect(params.row.id, value)}
              renderInput={(inputParams) => (
                <TextField
                  {...(inputParams as any)}
                  placeholder="Select item..."
                  variant="standard"
                  autoFocus
                />
              )}
              sx={{
                '& .MuiInput-root': {
                  '&:before': { borderBottom: 'none' },
                  '&:after': { borderBottom: 'none' },
                  '&:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                },
              }}
            />
          );
        }

        return (
          <Typography variant="body2" fontWeight={500}>
            {params.row.therapy_name}
          </Typography>
        );
      },
    },
    {
      field: 'current_cost',
      headerName: 'Unit Cost',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: renderCurrency,
    },
    {
      field: 'quantity_on_hand',
      headerName: 'Qty on Hand',
      width: 120,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const itemKey = params.row.id;
        return (
          <TextField
            type="number"
            value={orderQuantities[itemKey] || 0}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              handleQuantityChange(itemKey, value);
            }}
            inputProps={{ min: 0, step: 1 }}
            inputRef={(el) => {
              quantityInputRefs.current[itemKey] = el;
            }}
            size="small"
            variant="standard"
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
        );
      },
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: renderCurrency,
    },
  ];

  // Handle create/save
  const handleSave = (status: 'draft' | 'pending_approval') => {
    const purchaseOrderData = {
      status,
      expected_delivery_date: expectedDeliveryDate,
      tax_amount: taxAmount,
      shipping_cost: shippingCost,
      order_notes: orderNotes,
      purchase_order_items: items
        .filter(item => {
          const quantity = orderQuantities[item.id] || 0;
          return quantity > 0 && item.therapy_id > 0;
        })
        .map(item => ({
          therapy_id: item.therapy_id,
          quantity_ordered: orderQuantities[item.id] || 0,
          unit_cost: item.current_cost || 0,
        })),
    };

    if (isEditMode && existingPO) {
      // Update existing PO
      updatePurchaseOrder.mutate(
        { po_id: existingPO.po_id, ...purchaseOrderData },
        {
          onSuccess: () => {
            // Reset modal state
            setItems([]);
            setOrderQuantities({});
            setTaxAmount(0);
            setShippingCost(0);
            setExpectedDeliveryDate(null);
            setOrderNotes('');
            setEditingItemId(null);
            onClose();
            if (onSuccess) onSuccess();
          },
        }
      );
    } else {
      // Create new PO
      createPurchaseOrder.mutate(purchaseOrderData, {
        onSuccess: () => {
          // Reset modal state
          setItems([]);
          setOrderQuantities({});
          setTaxAmount(0);
          setShippingCost(0);
          setExpectedDeliveryDate(null);
          setOrderNotes('');
          setEditingItemId(null);
          onClose();
          if (onSuccess) onSuccess();
        },
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 0,
          bgcolor: 'white',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Typography variant="h6" component="div" fontWeight="bold">
          {isEditMode ? `Edit Purchase Order ${existingPO?.po_number}` : 'Create Purchase Order'}
        </Typography>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          pt: 1,
          pb: 1,
          overflow: 'auto',
          maxHeight: 'calc(90vh - 120px)',
        }}
      >
        {/* Add Item Button */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
            sx={{
              borderRadius: 0,
              fontWeight: 600,
            }}
          >
            Add Item
          </Button>
        </Box>

        {/* Order Items Table */}
        <Box sx={{ mb: 3 }}>
          <BaseDataTable
            title=""
            data={tableData}
            columns={orderItemColumns}
            loading={false}
            showCreateButton={false}
            showActionsColumn={false}
            gridHeight={300}
            autoHeight={false}
            enableExport={false}
            sortModel={[{ field: 'therapy_name', sort: 'asc' }]}
          />
        </Box>

        {/* Order Details */}
        <Box sx={{ mb: 3 }}>
          {/* Row 1: Expected Delivery Date, Tax Amount, Shipping Cost */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              fullWidth
              type="date"
              label="Expected Delivery Date"
              value={expectedDeliveryDate || ''}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                },
              }}
            />
            <TextField
              fullWidth
              type="number"
              label="Tax Amount"
              value={taxAmount}
              onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                },
              }}
            />
            <TextField
              fullWidth
              type="number"
              label="Shipping Cost"
              value={shippingCost}
              onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                },
              }}
            />
          </Box>

          {/* Row 2: Notes */}
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Notes"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Special instructions or notes..."
            sx={{
              mb: 0,
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
              },
            }}
          />
        </Box>

        {/* Total Summary */}
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              Total:
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="primary.main">
              ${calculateTotal().toFixed(2)}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="outlined"
          onClick={() => handleSave('draft')}
          disabled={(createPurchaseOrder.isPending || updatePurchaseOrder.isPending) || tableData.length === 0}
          sx={{
            borderRadius: 0,
            fontWeight: 600,
          }}
        >
          {(createPurchaseOrder.isPending || updatePurchaseOrder.isPending) ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSave('pending_approval')}
          disabled={(createPurchaseOrder.isPending || updatePurchaseOrder.isPending) || tableData.length === 0}
          sx={{
            borderRadius: 0,
            fontWeight: 600,
          }}
        >
          {(createPurchaseOrder.isPending || updatePurchaseOrder.isPending) 
            ? (isEditMode ? 'Updating...' : 'Creating...') 
            : (isEditMode ? 'Update Purchase Order' : 'Create Purchase Order')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

