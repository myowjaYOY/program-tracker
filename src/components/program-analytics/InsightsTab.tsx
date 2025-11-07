'use client';

import { Box, Grid, Card, CardContent, Typography, Alert, Chip, Button, CircularProgress } from '@mui/material';
import { TrendingUp, TrendingDown, Warning, CheckCircle, Info, Refresh } from '@mui/icons-material';
import { useState } from 'react';

interface InsightsTabProps {
  metrics: any;
}

export default function InsightsTab({ metrics }: InsightsTabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      const response = await fetch('/api/analytics/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to refresh analytics');
      }
      
      // Refresh the page to show new data
      window.location.reload();
    } catch (error: any) {
      setRefreshError(error.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!metrics) {
    return <Alert severity="info">No analytics data available</Alert>;
  }

  // Parse MSQ statistical measures
  const msqSuccessRates = typeof metrics.compliance_success_rates === 'string'
    ? JSON.parse(metrics.compliance_success_rates)
    : metrics.compliance_success_rates || [];
  
  const msqEffectSize = typeof metrics.compliance_effect_size === 'string'
    ? JSON.parse(metrics.compliance_effect_size)
    : metrics.compliance_effect_size || {};
  
  const msqOddsRatio = typeof metrics.compliance_odds_ratio === 'string'
    ? JSON.parse(metrics.compliance_odds_ratio)
    : metrics.compliance_odds_ratio || {};
  
  // Parse PROMIS-29 statistical measures
  const promisSuccessRates = typeof metrics.promis_success_rates === 'string'
    ? JSON.parse(metrics.promis_success_rates)
    : metrics.promis_success_rates || [];
  
  const promisEffectSize = typeof metrics.promis_effect_size === 'string'
    ? JSON.parse(metrics.promis_effect_size)
    : metrics.promis_effect_size || {};
  
  const promisOddsRatio = typeof metrics.promis_odds_ratio === 'string'
    ? JSON.parse(metrics.promis_odds_ratio)
    : metrics.promis_odds_ratio || {};
  
  const atRiskMembers = typeof metrics.at_risk_members === 'string'
    ? JSON.parse(metrics.at_risk_members)
    : metrics.at_risk_members || [];

  const complianceByCategory = typeof metrics.avg_compliance_by_category === 'string'
    ? JSON.parse(metrics.avg_compliance_by_category)
    : metrics.avg_compliance_by_category || {};

  // Helper to get tier color based on success rate
  const getTierColor = (tier: string) => {
    if (tier.includes('Low')) return 'error';
    if (tier.includes('Medium')) return 'warning';
    return 'success';
  };
  
  // Interpret odds ratio (reusable for both MSQ and PROMIS)
  const interpretOddsRatio = (oddsRatio: any) => {
    if (!oddsRatio.odds_ratio) return { severity: 'info' as const, message: 'Insufficient data' };
    const or = oddsRatio.odds_ratio;
    if (or > 5) return { severity: 'success' as const, message: `Strong effect: ${or}x more likely to improve` };
    if (or > 2) return { severity: 'success' as const, message: `Moderate effect: ${or}x more likely to improve` };
    if (or > 1) return { severity: 'warning' as const, message: `Weak effect: ${or}x more likely to improve` };
    return { severity: 'error' as const, message: 'No advantage detected' };
  };
  
  const msqOrInterpretation = interpretOddsRatio(msqOddsRatio);
  const promisOrInterpretation = interpretOddsRatio(promisOddsRatio);

  // Key insights
  const criticalCompliance = Object.entries(complianceByCategory).filter(
    ([_, value]) => (value as number) < 50
  );

  return (
    <Box>
      {/* Refresh Button and Error */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Last calculated: {new Date(metrics.calculated_at).toLocaleString()}
        </Typography>
        <Button
          variant="contained"
          startIcon={isRefreshing ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Recalculating...' : 'Refresh Analytics'}
        </Button>
      </Box>

      {refreshError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Failed to refresh analytics: {refreshError}
          </Typography>
        </Alert>
      )}

      {/* Statistical Analysis: MSQ vs PROMIS-29 Side-by-Side */}
      <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
        Statistical Analysis: MSQ (Symptoms) vs PROMIS-29 (Quality of Life)
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Comparing Two Outcomes:</strong> MSQ measures symptom burden (lower = better), 
          while PROMIS-29 measures quality of life (T-scores, lower = better for most domains). 
          These may show different patterns!
        </Typography>
      </Alert>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* MSQ Analysis (Left Column) */}
        <Grid size={6}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: 'primary.main' }}>
            MSQ: Medical Symptoms Questionnaire
          </Typography>
          
          {/* MSQ Success Rates */}
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.primary.main}`, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Success Rates by Tier
              </Typography>
              <Grid container spacing={1} sx={{ mt: 1 }}>
                {msqSuccessRates.map((tier: any) => (
                  <Grid size={12} key={tier.tier}>
                    <Box sx={{ p: 1.5, bgcolor: `${getTierColor(tier.tier)}.lighter`, borderRadius: 1, border: `2px solid`, borderColor: `${getTierColor(tier.tier)}.main` }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={600} color={`${getTierColor(tier.tier)}.main`}>
                          {tier.tier}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color={`${getTierColor(tier.tier)}.main`}>
                          {tier.success_rate || 0}%
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {tier.improved || 0}/{tier.total || 0} improved (Avg: {tier.avg_change || 0} pts)
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* MSQ Effect Size */}
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}`, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Effect Size
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem' }}>
                High (≥70%): {msqEffectSize.high_compliance_avg || 0} pts · 
                Low (&lt;40%): {msqEffectSize.low_compliance_avg || 0} pts
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                +{msqEffectSize.effect_size || 0} points
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {msqEffectSize.interpretation}
              </Typography>
            </CardContent>
          </Card>

          {/* MSQ Odds Ratio */}
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.success.main}` }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Odds Ratio
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main" sx={{ my: 1 }}>
                {msqOddsRatio.odds_ratio ? `${msqOddsRatio.odds_ratio}x` : 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {msqOddsRatio.interpretation}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* PROMIS-29 Analysis (Right Column) */}
        <Grid size={6}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: 'secondary.main' }}>
            PROMIS-29: Quality of Life Assessment
          </Typography>
          
          {/* PROMIS Success Rates */}
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.secondary.main}`, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Success Rates by Tier
              </Typography>
              <Grid container spacing={1} sx={{ mt: 1 }}>
                {promisSuccessRates.map((tier: any) => (
                  <Grid size={12} key={tier.tier}>
                    <Box sx={{ p: 1.5, bgcolor: `${getTierColor(tier.tier)}.lighter`, borderRadius: 1, border: `2px solid`, borderColor: `${getTierColor(tier.tier)}.main` }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={600} color={`${getTierColor(tier.tier)}.main`}>
                          {tier.tier}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color={`${getTierColor(tier.tier)}.main`}>
                          {tier.success_rate || 0}%
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {tier.improved || 0}/{tier.total || 0} improved (Avg: {tier.avg_change || 0} T-score)
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* PROMIS Effect Size */}
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}`, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Effect Size
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem' }}>
                High (≥70%): {promisEffectSize.high_compliance_avg || 0} T-score · 
                Low (&lt;40%): {promisEffectSize.low_compliance_avg || 0} T-score
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                +{promisEffectSize.effect_size || 0} T-score
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {promisEffectSize.interpretation}
              </Typography>
            </CardContent>
          </Card>

          {/* PROMIS Odds Ratio */}
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.success.main}` }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Odds Ratio
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main" sx={{ my: 1 }}>
                {promisOddsRatio.odds_ratio ? `${promisOddsRatio.odds_ratio}x` : 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {promisOddsRatio.interpretation}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* At-Risk Member Segmentation */}
      <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
        At-Risk Member Segmentation
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={12}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.warning.main}` }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Quadrant Analysis: Compliance vs. Health Improvement
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Members are segmented into four groups based on their compliance levels and health outcome trajectories.
              </Typography>

              <Grid container spacing={3} sx={{ mt: 2 }}>
                {/* Low Compliance, Worsening Health - CRITICAL */}
                <Grid size={3}>
                  <Box sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 2, border: '2px solid #f44336' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Warning sx={{ color: 'error.main', mr: 1 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="error.main">
                        CRITICAL
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold" color="error.main">
                      {atRiskMembers.filter((m: any) => m.segment === 'high_priority').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Low compliance + worsening health
                    </Typography>
                  </Box>
                </Grid>

                {/* Low Compliance, Improving Health */}
                <Grid size={3}>
                  <Box sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 2, border: '2px solid #ff9800' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Info sx={{ color: 'warning.main', mr: 1 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="warning.main">
                        MONITOR
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {atRiskMembers.filter((m: any) => m.segment === 'motivational_support').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Low compliance but improving
                    </Typography>
                  </Box>
                </Grid>

                {/* High Compliance, Worsening Health */}
                <Grid size={3}>
                  <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '2px solid #2196f3' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <TrendingDown sx={{ color: 'info.main', mr: 1 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="info.main">
                        INVESTIGATE
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {atRiskMembers.filter((m: any) => m.segment === 'clinical_attention').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      High compliance but not improving
                    </Typography>
                  </Box>
                </Grid>

                {/* High Compliance, Improving Health - SUCCESS */}
                <Grid size={3}>
                  <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, border: '2px solid #4caf50' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <CheckCircle sx={{ color: 'success.main', mr: 1 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="success.main">
                        SUCCESS
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {atRiskMembers.filter((m: any) => m.segment === 'success_stories').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      High compliance + improving
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Key Insights & Recommendations */}
      <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
        Key Insights & Recommended Actions
      </Typography>

      <Grid container spacing={3}>
        {criticalCompliance.length > 0 && (
          <Grid size={12}>
            <Alert severity="error" icon={<Warning />}>
              <Typography variant="subtitle2" fontWeight={600}>
                Critical Compliance Crisis Detected
              </Typography>
              <Typography variant="body2">
                {criticalCompliance.length} compliance area{criticalCompliance.length > 1 ? 's are' : ' is'} below 50%: 
                {criticalCompliance.map(([key, value]) => ` ${key} (${(value as number).toFixed(1)}%)`).join(', ')}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>
                → Immediate coordinator intervention required to prevent program dropouts
              </Typography>
            </Alert>
          </Grid>
        )}

        <Grid size={6}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.info.main}`, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                What's Working
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                {Object.entries(complianceByCategory)
                  .filter(([_, value]) => (value as number) >= 70)
                  .map(([key, value]) => (
                    <li key={key}>
                      <Typography variant="body2">
                        <strong>{key}:</strong> {(value as number).toFixed(1)}% compliance - maintaining strong adherence
                      </Typography>
                    </li>
                  ))}
                {atRiskMembers.filter((m: any) => m.segment === 'success_stories').length > 0 && (
                  <li>
                    <Typography variant="body2">
                      <strong>{atRiskMembers.filter((m: any) => m.segment === 'success_stories').length} members</strong> are thriving (high compliance + improving health)
                    </Typography>
                  </li>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={6}>
          <Card sx={{ borderTop: (theme) => `4px solid ${theme.palette.error.main}`, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
                Needs Attention
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                {Object.entries(complianceByCategory)
                  .filter(([_, value]) => (value as number) < 70)
                  .map(([key, value]) => (
                    <li key={key}>
                      <Typography variant="body2">
                        <strong>{key}:</strong> {(value as number).toFixed(1)}% compliance - {(value as number) < 50 ? 'CRITICAL' : 'requires improvement'}
                      </Typography>
                    </li>
                  ))}
                {atRiskMembers.filter((m: any) => m.segment === 'high_priority').length > 0 && (
                  <li>
                    <Typography variant="body2" color="error">
                      <strong>{atRiskMembers.filter((m: any) => m.segment === 'high_priority').length} members</strong> at high risk (low compliance + worsening health)
                    </Typography>
                  </li>
                )}
                {atRiskMembers.filter((m: any) => m.segment === 'clinical_attention').length > 0 && (
                  <li>
                    <Typography variant="body2" color="warning.main">
                      <strong>{atRiskMembers.filter((m: any) => m.segment === 'clinical_attention').length} members</strong> need investigation (high compliance but not improving)
                    </Typography>
                  </li>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

