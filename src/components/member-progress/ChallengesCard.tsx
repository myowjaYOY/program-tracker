'use client';

import React, { useState } from 'react';
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
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Warning as ChallengeIcon,
  InfoOutlined as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  const [expanded, setExpanded] = useState(false);
  const hasChallenges = data.latest_concerns.length > 0;

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', borderTop: 3, borderTopColor: '#f59e0b' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: expanded ? 2 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChallengeIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
            <Typography variant="subtitle2" fontWeight="bold" color="#f59e0b">
              Challenges
            </Typography>
            {hasChallenges && (
              <Chip
                label={data.latest_concerns.length}
                size="small"
                sx={{
                  backgroundColor: '#f59e0b20',
                  color: '#f59e0b',
                  height: 20,
                  fontSize: '0.7rem',
                }}
              />
            )}
          </Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ p: 0.5 }}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
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
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

