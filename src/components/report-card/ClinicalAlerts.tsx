'use client';

import React from 'react';
import { Box, Typography, Alert, Grid } from '@mui/material';
import type { ClinicalAlert } from '@/types/database.types';

interface ClinicalAlertsProps {
  alerts: ClinicalAlert[];
}

/**
 * Clinical Alerts Component
 * 
 * Displays 3 clinical alert cards based on rule-based pattern detection:
 * 1. Critical alerts (🚨 High Toxic Load)
 * 2. Warning alerts (⚠️ Food Sensitivity)
 * 3. Improving alerts (✅ Symptoms Responding)
 */
export default function ClinicalAlerts({ alerts }: ClinicalAlertsProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Clinical Alerts
      </Typography>

      <Grid container spacing={2}>
        {alerts.map((alert, index) => (
          <Grid key={index} size={{ xs: 12, md: 4 }}>
            <Alert
              severity={getAlertSeverity(alert.type)}
              icon={<Typography sx={{ fontSize: 24 }}>{alert.icon}</Typography>}
              sx={{
                height: '100%',
                '& .MuiAlert-message': {
                  width: '100%',
                },
              }}
            >
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {alert.title}
              </Typography>
              <Typography variant="body2">{alert.message}</Typography>
            </Alert>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getAlertSeverity(
  type: 'critical' | 'warning' | 'improving'
): 'error' | 'warning' | 'success' | 'info' {
  switch (type) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    case 'improving':
      return 'success';
    default:
      return 'info';
  }
}

