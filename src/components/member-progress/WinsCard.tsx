'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert as MuiAlert,
} from '@mui/material';
import {
  EmojiEvents as WinIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { MemberProgressDashboard, Alert } from '@/types/common';

interface WinsCardProps {
  data: MemberProgressDashboard;
}

/**
 * Win Item Component
 */
interface WinItemProps {
  alert: Alert;
}

function WinItem({ alert }: WinItemProps) {
  const date = new Date(alert.date).toLocaleDateString();

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
        <WinIcon sx={{ fontSize: 20, color: '#10b981' }} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight="500">
            {alert.message}
          </Typography>
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
 * Wins Card Component
 * 
 * Displays recent wins from survey responses
 */
export default function WinsCard({ data }: WinsCardProps) {
  const hasWins = data.latest_wins.length > 0;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <WinIcon sx={{ fontSize: 24, color: '#10b981' }} />
          <Typography variant="h6" fontWeight="bold" color="#10b981">
            Wins
          </Typography>
          {hasWins && (
            <Box
              sx={{
                ml: 'auto',
                backgroundColor: '#10b98120',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.75rem',
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
              }}
            >
              {data.latest_wins.length}
            </Box>
          )}
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Recent positive health results and successes
        </Typography>

        {/* No wins state */}
        {!hasWins && (
          <MuiAlert severity="info" icon={<InfoIcon />}>
            No wins reported in recent surveys
          </MuiAlert>
        )}

        {/* Wins List */}
        {hasWins && (
          <List disablePadding>
            {data.latest_wins.map((win, idx) => (
              <WinItem key={`win-${idx}`} alert={win} />
            ))}
          </List>
        )}

        {/* Encouragement */}
        {hasWins && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="textSecondary" fontStyle="italic">
              🎉 Celebrating progress and positive outcomes!
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

