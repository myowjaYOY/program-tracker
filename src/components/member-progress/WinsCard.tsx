'use client';

import React, { useState } from 'react';
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
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  EmojiEvents as WinIcon,
  InfoOutlined as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  const [expanded, setExpanded] = useState(false);
  const hasWins = data.latest_wins.length > 0;

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', borderTop: 3, borderTopColor: '#10b981' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: expanded ? 2 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WinIcon sx={{ fontSize: 20, color: '#10b981' }} />
            <Typography variant="subtitle2" fontWeight="bold" color="#10b981">
              Wins
            </Typography>
            {hasWins && (
              <Chip
                label={data.latest_wins.length}
                size="small"
                sx={{
                  backgroundColor: '#10b98120',
                  color: '#10b981',
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
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

