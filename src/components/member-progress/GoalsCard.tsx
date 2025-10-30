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
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Flag as GoalIcon,
  EmojiEvents as WinIcon,
  Warning as AtRiskIcon,
  TrendingUp as OnTrackIcon,
  InfoOutlined as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { MemberProgressDashboard, Goal, GoalStatus } from '@/types/common';

interface GoalsCardProps {
  data: MemberProgressDashboard;
}

/**
 * Goal status configuration
 */
const STATUS_CONFIG: Record<GoalStatus, { 
  icon: React.ElementType; 
  color: string; 
  label: string;
  bgColor: string;
}> = {
  win: {
    icon: WinIcon,
    color: '#10b981',
    label: 'Achieved',
    bgColor: '#10b98120',
  },
  on_track: {
    icon: OnTrackIcon,
    color: '#3b82f6',
    label: 'On Track',
    bgColor: '#3b82f620',
  },
  at_risk: {
    icon: AtRiskIcon,
    color: '#ef4444',
    label: 'At Risk',
    bgColor: '#ef444420',
  },
  insufficient_data: {
    icon: InfoIcon,
    color: '#6b7280',
    label: 'Insufficient Data',
    bgColor: '#6b728020',
  },
};

/**
 * Goal Item Component
 */
interface GoalItemProps {
  goal: Goal;
}

function GoalItem({ goal }: GoalItemProps) {
  const statusConfig = STATUS_CONFIG[goal.status];
  const StatusIcon = statusConfig.icon;

  return (
    <ListItem
      sx={{
        px: 0,
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-child': {
          borderBottom: 0,
        },
        alignItems: 'flex-start',
      }}
    >
      <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
        <StatusIcon sx={{ fontSize: 24, color: statusConfig.color }} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight="500">
                {goal.goal_text}
              </Typography>
              {goal.progress_summary && (
                <Tooltip 
                  title={
                    <Box sx={{ p: 1 }}>
                      <Typography variant="body2" color="text.primary">
                        {goal.progress_summary}
                      </Typography>
                    </Box>
                  }
                  arrow 
                  placement="top"
                  componentsProps={{
                    tooltip: {
                      sx: {
                        backgroundColor: 'background.paper',
                        color: 'text.primary',
                        boxShadow: 3,
                        border: 1,
                        borderColor: 'divider',
                        maxWidth: 300,
                        '& .MuiTooltip-arrow': {
                          color: 'background.paper',
                          '&::before': {
                            border: 1,
                            borderColor: 'divider',
                          },
                        },
                      },
                    },
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{
                      p: 0,
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main',
                      },
                    }}
                  >
                    <InfoIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            <Chip
              label={statusConfig.label}
              size="small"
              sx={{
                backgroundColor: statusConfig.bgColor,
                color: statusConfig.color,
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 22,
              }}
            />
          </Box>
        }
      />
    </ListItem>
  );
}

/**
 * Goals Card Component
 * 
 * Displays member's SMART goals from Goals & Whys survey
 */
export default function GoalsCard({ data }: GoalsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasGoals = data.goals.length > 0;
  
  // Count goals by status
  const goalCounts = {
    win: data.goals.filter((g) => g.status === 'win').length,
    on_track: data.goals.filter((g) => g.status === 'on_track').length,
    at_risk: data.goals.filter((g) => g.status === 'at_risk').length,
    insufficient_data: data.goals.filter((g) => g.status === 'insufficient_data').length,
  };

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', borderTop: 3, borderTopColor: 'primary.main' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: expanded ? 2 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GoalIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight="bold">
              Goals & Progress
            </Typography>
            {hasGoals && (
              <Chip
                label={data.goals.length}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ p: 0.5 }}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
            {/* No goals state */}
            {!hasGoals && (
              <MuiAlert severity="info" icon={<InfoIcon />}>
                No goals set yet. Goals are captured in the "Goals & Whys" survey.
              </MuiAlert>
            )}

            {/* Goals List */}
            {hasGoals && (
          <>
            {/* Wins First */}
            {goalCounts.win > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight="bold" color={STATUS_CONFIG.win.color} sx={{ mb: 1 }}>
                  Achieved Goals 🎉
                </Typography>
                <List disablePadding>
                  {data.goals
                    .filter((g) => g.status === 'win')
                    .map((goal, idx) => (
                      <GoalItem key={`win-${idx}`} goal={goal} />
                    ))}
                </List>
              </Box>
            )}

            {/* On Track */}
            {goalCounts.on_track > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight="bold" color={STATUS_CONFIG.on_track.color} sx={{ mb: 1 }}>
                  On Track
                </Typography>
                <List disablePadding>
                  {data.goals
                    .filter((g) => g.status === 'on_track')
                    .map((goal, idx) => (
                      <GoalItem key={`on-track-${idx}`} goal={goal} />
                    ))}
                </List>
              </Box>
            )}

            {/* At Risk */}
            {goalCounts.at_risk > 0 && (
              <Box sx={{ mb: goalCounts.insufficient_data > 0 ? 3 : 0 }}>
                <Typography variant="subtitle2" fontWeight="bold" color={STATUS_CONFIG.at_risk.color} sx={{ mb: 1 }}>
                  At Risk - Needs Support
                </Typography>
                <List disablePadding>
                  {data.goals
                    .filter((g) => g.status === 'at_risk')
                    .map((goal, idx) => (
                      <GoalItem key={`at-risk-${idx}`} goal={goal} />
                    ))}
                </List>
              </Box>
            )}

            {/* Insufficient Data */}
            {goalCounts.insufficient_data > 0 && (
              <Box sx={{ mb: 0 }}>
                <Typography variant="subtitle2" fontWeight="bold" color={STATUS_CONFIG.insufficient_data.color} sx={{ mb: 1 }}>
                  Insufficient Data
                </Typography>
                <List disablePadding>
                  {data.goals
                    .filter((g) => g.status === 'insufficient_data')
                    .map((goal, idx) => (
                      <GoalItem key={`insufficient-${idx}`} goal={goal} />
                    ))}
                </List>
              </Box>
            )}
              </>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

