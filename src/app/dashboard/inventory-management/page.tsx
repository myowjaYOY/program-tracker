'use client';

import { Box, Typography, Card, CardContent, Tabs, Tab, Button, CircularProgress, Grid } from '@mui/material';
import { useState } from 'react';
import {
  Add as AddIcon,
  Description as DescriptionIcon,
  Inventory as InventoryIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  RuleFolder as RuleFolderIcon,
} from '@mui/icons-material';
import PurchaseOrderTable from '@/components/purchase-orders/purchase-order-table';
import CreatePOModal from '@/components/purchase-orders/create-po-modal';
import InventoryItemsTab from '@/components/inventory/inventory-items-tab';
import PhysicalCountTab from '@/components/inventory/physical-count-tab';
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
      {value === index && <Box>{children}</Box>}
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
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            color="primary.main"
          >
            Inventory Management
          </Typography>
        </Box>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Card 1: Pending Approval */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
                  <PendingIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Purchase Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Low Stock Items */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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

        {/* Card 4: In-Progress Counts */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.primary.main}`,
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
                    In-Progress
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'primary.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.in_progress_counts || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'primary.main',
                    opacity: 0.8,
                  }}
                >
                  <AssignmentTurnedInIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Count Sessions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 5: Pending Variances */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderTop: (theme) => `4px solid ${theme.palette.secondary.main}`,
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
                    Pending Variance
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      color: 'secondary.main',
                      mt: 1,
                    }}
                  >
                    {metricsLoading ? (
                      <CircularProgress size={32} />
                    ) : (
                      metrics?.pending_variances || 0
                    )}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    color: 'secondary.main',
                    opacity: 0.8,
                  }}
                >
                  <RuleFolderIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Require Approval
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Section - Wrapped in Card for visual separation */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          {/* Tabs */}
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="inventory management tabs"
            sx={{ 
              '& .MuiTabs-flexContainer': { gap: 4 },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
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
              icon={<InventoryIcon />} 
              iconPosition="start" 
              label="Inventory" 
              {...a11yProps(1)} 
            />
            <Tab 
              icon={<AssignmentTurnedInIcon />} 
              iconPosition="start" 
              label="Physical Count" 
              {...a11yProps(2)} 
            />
          </Tabs>

          {/* Tab Panels */}
          <Box sx={{ mt: 2 }}>
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
              <InventoryItemsTab />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <PhysicalCountTab />
            </TabPanel>
          </Box>
        </CardContent>
      </Card>

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

