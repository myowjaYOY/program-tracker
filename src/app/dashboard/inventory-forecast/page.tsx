'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  TextField,
  MenuItem,
  Divider,
  Checkbox,
  ListItemText,
  Select,
  InputLabel,
  FormControl,
  OutlinedInput,
} from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import {
  AttachMoney as MoneyIcon,
  Inventory2 as InventoryIcon,
  CalendarMonth as CalendarIcon,
  NextPlan as NextPlanIcon,
} from '@mui/icons-material';
import { useInventoryForecast } from '@/lib/hooks/use-inventory-forecast';
import { useActiveTherapyTypes } from '@/lib/hooks/use-therapy-types';
import { GridColDef } from '@mui/x-data-grid-pro';
import BaseDataTable, { renderCurrency } from '@/components/tables/base-data-table';
import type { InventoryForecastRow } from '@/types/database.types';

export default function InventoryForecastPage() {
  // Filter state
  const [dateRange, setDateRange] = useState<'this_month' | 'next_month' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [therapyTypeFilter, setTherapyTypeFilter] = useState<number[]>([]);

  // Fetch therapy types for filter
  const { data: therapyTypes = [], isLoading: therapyTypesLoading } = useActiveTherapyTypes();

  // Fetch UNFILTERED metrics (not affected by filters - like all other pages)
  const { data: metricsData } = useInventoryForecast({
    range: 'this_month', // Always fetch this month metrics
    start: null,
    end: null,
    therapyTypes: null, // No therapy type filter for metrics
  });

  // Fetch FILTERED data for grid (affected by user filters)
  const { data: gridData, isLoading, error } = useInventoryForecast({
    range: dateRange,
    start: dateRange === 'custom' ? startDate : null,
    end: dateRange === 'custom' ? endDate : null,
    therapyTypes: therapyTypeFilter.length > 0 ? therapyTypeFilter : null,
  });

  const inventoryData = gridData?.data || [];
  const metrics = metricsData?.metrics || {
    total_cost_owed: 0,
    total_products_owed: 0,
    cost_owed_this_month: 0,
    cost_owed_next_month: 0,
  };

  // Handle date range change
  const handleDateRangeChange = (value: string) => {
    const newRange = value as 'this_month' | 'next_month' | 'custom';
    setDateRange(newRange);
    
    // Set default dates for custom range
    if (newRange === 'custom' && !startDate && !endDate) {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(lastDay.toISOString().slice(0, 10));
    }
  };

  // Define data grid columns
  const columns: GridColDef<InventoryForecastRow>[] = [
    {
      field: 'therapy_type_name',
      headerName: 'Therapy Type',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'therapy_name',
      headerName: 'Therapy Name',
      width: 250,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'dispensed_count',
      headerName: 'Dispensed',
      width: 120,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'owed_count',
      headerName: 'Owed',
      width: 120,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium" color="warning.main">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'total_count',
      headerName: 'Total',
      width: 120,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'item_cost',
      headerName: 'Cost (per item)',
      width: 140,
      type: 'number',
      renderCell: renderCurrency as any,
    },
  ];

  return (
    <Box sx={{ p: 3, height: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          fontWeight="bold"
          color="primary.main"
          sx={{ mb: 1 }}
        >
          Inventory Forecast Report
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monthly inventory forecast for ordering products based on scheduled therapies
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Card 1: Total Cost Owed */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              borderTop: (theme) => `4px solid ${theme.palette.error.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                    Cost of Undispensed Products
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{ fontWeight: 'bold', color: 'error.main', mt: 1 }}
                  >
                    ${metrics.total_cost_owed.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ color: 'error.main', opacity: 0.8 }}>
                  <MoneyIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Total cost of all undispensed items
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Total Products Owed */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              borderTop: (theme) => `4px solid ${theme.palette.warning.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                    Total Products Owed
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{ fontWeight: 'bold', color: 'warning.main', mt: 1 }}
                  >
                    {metrics.total_products_owed.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ color: 'warning.main', opacity: 0.8 }}>
                  <InventoryIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Total count of undispensed items
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Cost Owed This Month */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              borderTop: (theme) => `4px solid ${theme.palette.info.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                    Cost Owed This Month
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{ fontWeight: 'bold', color: 'info.main', mt: 1 }}
                  >
                    ${metrics.cost_owed_this_month.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ color: 'info.main', opacity: 0.8 }}>
                  <CalendarIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Cost of items owed this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 4: Cost Owed Next Month */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              borderTop: (theme) => `4px solid ${theme.palette.success.main}`,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => theme.shadows[4],
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
                    Cost Owed Next Month
                  </Typography>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{ fontWeight: 'bold', color: 'success.main', mt: 1 }}
                  >
                    ${metrics.cost_owed_next_month.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ color: 'success.main', opacity: 0.8 }}>
                  <NextPlanIcon sx={{ fontSize: 40 }} />
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Cost of items owed next month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Grid with Filters */}
      <Card>
        <CardContent>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            {/* Therapy Type Multi-Select Filter - FIRST */}
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Therapy Type</InputLabel>
              <Select
                multiple
                value={therapyTypeFilter}
                onChange={(e) => setTherapyTypeFilter(e.target.value as number[])}
                input={<OutlinedInput label="Therapy Type" />}
                renderValue={(selected) => 
                  selected.length === 0 
                    ? 'All Types' 
                    : selected
                        .map(id => therapyTypes.find(t => t.therapy_type_id === id)?.therapy_type_name)
                        .filter(Boolean)
                        .join(', ')
                }
                disabled={therapyTypesLoading}
              >
                {therapyTypes.map((type) => (
                  <MenuItem key={type.therapy_type_id} value={type.therapy_type_id}>
                    <Checkbox checked={therapyTypeFilter.includes(type.therapy_type_id)} />
                    <ListItemText primary={type.therapy_type_name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date Range Filter - SECOND */}
            <TextField
              select
              label="Date Range"
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="this_month">This Month</MenuItem>
              <MenuItem value="next_month">Next Month</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </TextField>

            {/* Custom Date Range Inputs */}
            {dateRange === 'custom' && (
              <>
                <TextField
                  type="date"
                  label="Start Date"
                  value={startDate || ''}
                  onChange={(e) => setStartDate(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 160 }}
                />
                <TextField
                  type="date"
                  label="End Date"
                  value={endDate || ''}
                  onChange={(e) => setEndDate(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 160 }}
                />
              </>
            )}
          </Box>

          {/* Divider */}
          <Box sx={{ mb: 2 }}>
            <Divider />
          </Box>

          {/* Loading State */}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Error State */}
          {error && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="error">
                Error: {error.message}
              </Typography>
            </Box>
          )}

          {/* Data Grid */}
          {!isLoading && !error && (
            <BaseDataTable<InventoryForecastRow>
              title=""
              data={inventoryData.map((row, index) => ({
                ...row,
                id: `${row.therapy_type_name}-${row.therapy_name}-${index}`,
              }))}
              columns={columns}
              loading={isLoading}
              showCreateButton={false}
              showActionsColumn={false}
              sortModel={[
                { field: 'therapy_type_name', sort: 'asc' },
                { field: 'therapy_name', sort: 'asc' },
              ]}
              enableExport={true}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

