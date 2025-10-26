'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert as MuiAlert,
} from '@mui/material';
import {
  Warning as ChallengeIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { MemberProgressDashboard, Alert } from '@/types/common';

interface ChallengesCardProps {
  data: MemberProgressDashboard;
}

/**
 * Severity color mapping for challenges
 */
const SEVERITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
};

/**
 * Challenge Item Component
 */
interface ChallengeItemProps {
  alert: Alert;
}

function ChallengeItem({ alert }: ChallengeItemProps) {
  const date = new Date(alert.date).toLocaleDateString();
  const severityColor = alert.severity ? SEVERITY_COLORS[alert.severity] || '#6b7280' : '#6b7280';

  return (
    <ListItem
      sx={{
        px: 0,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-child': {
          borderBottom: 0,
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        <ChallengeIcon sx={{ fontSize: 20, color: severityColor }} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="500">
              {alert.message}
            </Typography>
            {alert.severity && (
              <Chip
                label={alert.severity}
                size="small"
                sx={{
                  backgroundColor: `${severityColor}20`,
                  color: severityColor,
                  fontWeight: 600,
                  fontSize: '0.65rem',
                  height: 18,
                  textTransform: 'uppercase',
                }}
              />
            )}
          </Box>
        }
        secondary={
          <Typography variant="caption" color="textSecondary">
            {date}
          </Typography>
        }
      />
    </ListItem>
  );
}

/**
 * Challenges Card Component
 * 
 * Displays recent challenges and concerns from survey responses
 */
export default function ChallengesCard({ data }: ChallengesCardProps) {
  const hasChallenges = data.latest_concerns.length > 0;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <ChallengeIcon sx={{ fontSize: 24, color: '#f59e0b' }} />
          <Typography variant="h6" fontWeight="bold" color="#f59e0b">
            Challenges
          </Typography>
          {hasChallenges && (
            <Box
              sx={{
                ml: 'auto',
                backgroundColor: '#f59e0b20',
                color: '#f59e0b',
                fontWeight: 600,
                fontSize: '0.75rem',
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
              }}
            >
              {data.latest_concerns.length}
            </Box>
          )}
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Recent obstacles, concerns, and areas needing support
        </Typography>

        {/* No challenges state */}
        {!hasChallenges && (
          <MuiAlert severity="success" icon={<InfoIcon />}>
            No challenges reported in recent surveys
          </MuiAlert>
        )}

        {/* Challenges List */}
        {hasChallenges && (
          <List disablePadding>
            {data.latest_concerns.map((concern, idx) => (
              <ChallengeItem key={`challenge-${idx}`} alert={concern} />
            ))}
          </List>
        )}

        {/* Action Recommendation */}
        {hasChallenges && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="textSecondary" fontStyle="italic">
              💡 Tip: High-severity challenges may require immediate follow-up
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

