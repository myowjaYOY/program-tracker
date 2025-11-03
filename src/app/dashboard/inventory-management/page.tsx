'use client';

import { Box, Typography, Card, CardContent, Tabs, Tab, Button, CircularProgress, Grid } from '@mui/material';
import { useState } from 'react';
import { 
  Add as AddIcon,
  Description as DescriptionIcon,
  LocalShipping as LocalShippingIcon,
  Inventory as InventoryIcon,
  Pending as PendingIcon,
  AttachMoney as AttachMoneyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import PurchaseOrderTable from '@/components/purchase-orders/purchase-order-table';
import CreatePOModal from '@/components/purchase-orders/create-po-modal';
import { useInventoryMetrics } from '@/lib/hooks/use-inventory-metrics';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`inventory-tabpanel-${index}`}
      aria-labelledby={`inventory-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `inventory-tab-${index}`,
    'aria-controls': `inventory-tabpanel-${index}`,
  };
}

export default function InventoryManagementPage() {
  const [tabValue, setTabValue] = useState(0);
  const [createPOModalOpen, setCreatePOModalOpen] = useState(false);
  
  // Fetch inventory metrics
  const { data: metrics, isLoading: metricsLoading } = useInventoryMetrics();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ p: 3, height: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontWeight: 600 }}
        >
          Inventory Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage purchase orders, track inventory, and monitor stock levels
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Card 1: Pending Approval */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.warning.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Pending Approval
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'warning.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.pending_approval_count || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'warning.main',
                    opacity: 0.8,
                  }}
                >
                  <PendingIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Purchase Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Awaiting Receipt */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.info.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Awaiting Receipt
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'info.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.awaiting_receipt_count || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'info.main',
                    opacity: 0.8,
                  }}
                >
                  <LocalShippingIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Purchase Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Open PO Value */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.success.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Open PO Value
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'success.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      `$${(metrics?.open_po_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'success.main',
                    opacity: 0.8,
                  }}
                >
                  <AttachMoneyIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Total Cost
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 4: Low Stock Items */}
        <Grid size={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.error.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    color="textSecondary"
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    Low Stock Items
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'error.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.low_stock_count || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'error.main',
                    opacity: 0.8,
                  }}
                >
                  <WarningIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Below Reorder Point
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="inventory management tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              minWidth: 180,
              mr: 2,
            },
          }}
        >
          <Tab 
            icon={<DescriptionIcon />} 
            iconPosition="start" 
            label="Purchase Orders" 
            {...a11yProps(0)} 
          />
          <Tab 
            icon={<LocalShippingIcon />} 
            iconPosition="start" 
            label="Ordered Items" 
            {...a11yProps(1)} 
          />
          <Tab 
            icon={<InventoryIcon />} 
            iconPosition="start" 
            label="Inventory" 
            {...a11yProps(2)} 
          />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        {/* Create New PO Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreatePOModalOpen(true)}
            sx={{
              borderRadius: 0,
              fontWeight: 600,
            }}
          >
            Create New PO
          </Button>
        </Box>
        
        <PurchaseOrderTable />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 0, minHeight: 400 }}>
          <Typography variant="body1" color="text.secondary">
            Ordered Items grid will appear here
          </Typography>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 0, minHeight: 400 }}>
          <Typography variant="body1" color="text.secondary">
          Inventory grid will appear here
        </Typography>
      </Box>
    </TabPanel>

      {/* Create PO Modal */}
      <CreatePOModal
        open={createPOModalOpen}
        onClose={() => setCreatePOModalOpen(false)}
        initialItems={[]}
        onSuccess={() => {
          // Refresh PO list (will be handled by React Query cache invalidation)
          setCreatePOModalOpen(false);
        }}
      />
    </Box>
  );
}

