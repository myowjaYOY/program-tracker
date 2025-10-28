'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface DashboardInfo {
  dashboard_count: number;
  member_count: number;
  last_analysis: string | null;
  status: string;
}

interface AnalysisResult {
  success: boolean;
  analyzed_count: number;
  failed_count: number;
  duration_seconds: number;
  errors: string[];
}

export default function AnalyticsAdminPage() {
  const queryClient = useQueryClient();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Fetch dashboard info
  const { data: dashboardInfo, isLoading: isLoadingInfo, error: infoError } = useQuery<DashboardInfo>({
    queryKey: ['dashboard-info'],
    queryFn: async () => {
      const response = await fetch('/api/admin/reanalyze-dashboards');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard info');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Re-analysis mutation
  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/reanalyze-dashboards', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to trigger re-analysis');
      }

      return response.json();
    },
    onMutate: () => {
      toast.loading('Re-analyzing all member dashboards...', { id: 'reanalyze' });
      setAnalysisResult(null);
    },
    onSuccess: (data) => {
      toast.success(`Successfully analyzed ${data.analyzed_count} members in ${data.duration_seconds}s`, {
        id: 'reanalyze',
        duration: 5000,
      });
      setAnalysisResult(data);
      
      // Refetch dashboard info
      queryClient.invalidateQueries({ queryKey: ['dashboard-info'] });
    },
    onError: (error: Error) => {
      toast.error(`Re-analysis failed: ${error.message}`, {
        id: 'reanalyze',
        duration: 7000,
      });
    },
  });

  const handleReanalyze = () => {
    if (confirm(`This will re-analyze all ${dashboardInfo?.member_count || 0} member dashboards. This may take 30-60 seconds. Continue?`)) {
      reanalyzeMutation.mutate();
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleString();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardIcon fontSize="large" />
          Dashboard Analytics
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Manage and monitor member progress dashboard calculations
        </Typography>
      </Box>

      {/* Error State */}
      {infoError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load dashboard information. Please try refreshing the page.
        </Alert>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Dashboard Statistics Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Dashboard Statistics" 
              titleTypographyProps={{ variant: 'h6' }}
            />
            <Divider />
            <CardContent>
              {isLoadingInfo ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                    Loading dashboard statistics...
                  </Typography>
                </Box>
              ) : dashboardInfo ? (
                <Box>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Members with Dashboards
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {dashboardInfo.dashboard_count}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      out of {dashboardInfo.member_count} total members
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Last Analysis
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <ScheduleIcon fontSize="small" color="action" />
                      <Typography variant="body1">
                        {formatDate(dashboardInfo.last_analysis)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      System Status
                    </Typography>
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={dashboardInfo.status === 'operational' ? 'Operational' : dashboardInfo.status}
                      color="success"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        {/* Re-Analysis Control Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Re-Analyze Dashboards" 
              titleTypographyProps={{ variant: 'h6' }}
            />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="textSecondary" paragraph>
                Trigger a complete re-analysis of all member progress dashboards. This is useful when:
              </Typography>
              <Box component="ul" sx={{ mb: 2, pl: 2 }}>
                <Typography component="li" variant="body2" color="textSecondary">
                  You've refined the wins/challenges classification logic
                </Typography>
                <Typography component="li" variant="body2" color="textSecondary">
                  Dashboard calculation logic has been updated
                </Typography>
                <Typography component="li" variant="body2" color="textSecondary">
                  You want to refresh data without new survey imports
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                startIcon={reanalyzeMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                onClick={handleReanalyze}
                disabled={reanalyzeMutation.isPending || isLoadingInfo}
                sx={{ mt: 2 }}
              >
                {reanalyzeMutation.isPending ? 'Re-Analyzing...' : 'Re-Analyze All Dashboards'}
              </Button>

              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                Estimated time: ~30-60 seconds for {dashboardInfo?.member_count || 0} members
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Analysis Result Card */}
        {analysisResult && (
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title="Latest Analysis Results" 
                titleTypographyProps={{ variant: 'h6' }}
              />
              <Divider />
              <CardContent>
                <Alert 
                  severity={analysisResult.success ? 'success' : 'warning'}
                  icon={analysisResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body1" fontWeight="bold">
                    {analysisResult.success 
                      ? 'Re-analysis completed successfully!'
                      : 'Re-analysis completed with errors'}
                  </Typography>
                </Alert>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.lighter', borderRadius: 2 }}>
                      <Typography variant="h4" color="success.main" fontWeight="bold">
                        {analysisResult.analyzed_count}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Successfully Analyzed
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.lighter', borderRadius: 2 }}>
                      <Typography variant="h4" color="error.main" fontWeight="bold">
                        {analysisResult.failed_count}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Failed
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.lighter', borderRadius: 2 }}>
                      <Typography variant="h4" color="info.main" fontWeight="bold">
                        {analysisResult.duration_seconds.toFixed(1)}s
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Duration
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {analysisResult.errors.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom color="error">
                      Errors:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                      {analysisResult.errors.slice(0, 5).map((error, index) => (
                        <Typography key={index} component="li" variant="caption" color="error">
                          {error}
                        </Typography>
                      ))}
                    </Box>
                    {analysisResult.errors.length > 5 && (
                      <Typography variant="caption" color="textSecondary">
                        ...and {analysisResult.errors.length - 5} more errors
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Information Card */}
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="About Dashboard Analysis" 
              titleTypographyProps={{ variant: 'h6' }}
            />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="textSecondary" paragraph>
                <strong>How it works:</strong> Member progress dashboards are pre-calculated and stored in the database for fast loading. They update automatically after each survey import, but you can manually trigger a re-analysis here.
              </Typography>
              
              <Typography variant="body2" color="textSecondary" paragraph>
                <strong>Performance:</strong> Re-analysis typically processes ~2.5 members per second. The actual time depends on the amount of survey data per member.
              </Typography>

              <Typography variant="body2" color="textSecondary">
                <strong>Safety:</strong> Re-analysis is a non-destructive operation. It recalculates and overwrites existing dashboard data but does not affect source survey data.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

