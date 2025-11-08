'use client';

import React from 'react';
import { Box, Card, CardContent, Typography, Grid, Chip, Alert } from '@mui/material';
import { PriorityHigh, Info, CheckCircle, TipsAndUpdates } from '@mui/icons-material';

interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  current_state: string;
  impact: string;
  action: string;
}

interface AIRecommendationsCardProps {
  recommendations: AIRecommendation[];
}

export default function AIRecommendationsCard({ recommendations }: AIRecommendationsCardProps) {
  // Helper to get priority details
  const getPriorityDetails = (priority: string) => {
    switch (priority) {
      case 'high':
        return {
          label: 'HIGH PRIORITY',
          color: 'error' as const,
          icon: <PriorityHigh />,
          bgcolor: 'error.lighter',
          borderColor: 'error.main'
        };
      case 'medium':
        return {
          label: 'MEDIUM PRIORITY',
          color: 'warning' as const,
          icon: <Info />,
          bgcolor: 'warning.lighter',
          borderColor: 'warning.main'
        };
      case 'low':
        return {
          label: 'LOW PRIORITY',
          color: 'info' as const,
          icon: <CheckCircle />,
          bgcolor: 'info.lighter',
          borderColor: 'info.main'
        };
      default:
        return {
          label: 'PRIORITY',
          color: 'default' as const,
          icon: <Info />,
          bgcolor: 'grey.100',
          borderColor: 'grey.400'
        };
    }
  };

  // Group recommendations by priority
  const highPriority = recommendations.filter(r => r.priority === 'high');
  const mediumPriority = recommendations.filter(r => r.priority === 'medium');
  const lowPriority = recommendations.filter(r => r.priority === 'low');

  return (
    <Card sx={{ mb: 3, borderTop: (theme) => `4px solid ${theme.palette.success.main}` }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TipsAndUpdates sx={{ color: 'success.main', fontSize: 28 }} />
          <Typography variant="h6" fontWeight={600}>
            Recommendations
          </Typography>
        </Box>

        {recommendations.length === 0 && (
          <Alert severity="info">
            <Typography variant="body2">
              No specific recommendations at this time. Member appears to be on track!
            </Typography>
          </Alert>
        )}

        {recommendations.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Evidence-based actions prioritized by potential impact on member outcomes.
          </Typography>
        )}

        <Grid container spacing={2}>
          {/* High Priority */}
          {highPriority.map((rec, index) => {
            const details = getPriorityDetails(rec.priority);
            
            return (
              <Grid size={12} key={`high-${index}`}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: details.bgcolor,
                    borderRadius: 2,
                    border: 2,
                    borderColor: details.borderColor
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Box sx={{ color: `${details.color}.main`, mt: 0.5 }}>
                      {details.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          label={details.label}
                          color={details.color}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                        />
                        <Typography variant="subtitle1" fontWeight={700} color={`${details.color}.main`}>
                          {rec.title}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box>
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            CURRENT STATE:
                          </Typography>
                          <Typography variant="body2">
                            {rec.current_state}
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            IMPACT:
                          </Typography>
                          <Typography variant="body2">
                            {rec.impact}
                          </Typography>
                        </Box>
                        
                        <Box
                          sx={{
                            p: 1.5,
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            border: 1,
                            borderColor: 'divider'
                          }}
                        >
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            RECOMMENDED ACTION:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {rec.action}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            );
          })}

          {/* Medium Priority */}
          {mediumPriority.map((rec, index) => {
            const details = getPriorityDetails(rec.priority);
            
            return (
              <Grid size={{ xs: 12, md: 6 }} key={`medium-${index}`}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: details.bgcolor,
                    borderRadius: 2,
                    border: 1,
                    borderColor: details.borderColor,
                    height: '100%'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={details.label}
                      color={details.color}
                      size="small"
                      sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                    />
                  </Box>
                  
                  <Typography variant="subtitle2" fontWeight={700} color={`${details.color}.main`} gutterBottom>
                    {rec.title}
                  </Typography>
                  
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
                    {rec.current_state}
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                    {rec.impact}
                  </Typography>
                  
                  <Box
                    sx={{
                      p: 1,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="caption" fontWeight={600} color={`${details.color}.main`}>
                      → {rec.action}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            );
          })}

          {/* Low Priority */}
          {lowPriority.map((rec, index) => {
            const details = getPriorityDetails(rec.priority);
            
            return (
              <Grid size={{ xs: 12, md: 6 }} key={`low-${index}`}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: details.bgcolor,
                    borderRadius: 1,
                    border: 1,
                    borderColor: details.borderColor,
                    height: '100%'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <CheckCircle sx={{ fontSize: 16, color: `${details.color}.main` }} />
                    <Typography variant="body2" fontWeight={600} color={`${details.color}.main`}>
                      {rec.title}
                    </Typography>
                  </Box>
                  
                  <Typography variant="caption" display="block" color="text.secondary">
                    {rec.action}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}

