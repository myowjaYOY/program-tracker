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
  Flag as GoalIcon,
  EmojiEvents as WinIcon,
  Warning as AtRiskIcon,
  TrendingUp as OnTrackIcon,
  InfoOutlined as InfoIcon,
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
            <Typography variant="body2" fontWeight="500" sx={{ mb: 1 }}>
              {goal.goal_text}
            </Typography>
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
  const hasGoals = data.goals.length > 0;
  
  // Count goals by status
  const goalCounts = {
    win: data.goals.filter((g) => g.status === 'win').length,
    on_track: data.goals.filter((g) => g.status === 'on_track').length,
    at_risk: data.goals.filter((g) => g.status === 'at_risk').length,
  };

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <GoalIcon sx={{ fontSize: 24, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">
            Goals & Progress
          </Typography>
          {hasGoals && (
            <Chip
              label={data.goals.length}
              size="small"
              color="primary"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          SMART goals from Goals & Whys survey
        </Typography>

        {/* No goals state */}
        {!hasGoals && (
          <MuiAlert severity="info" icon={<InfoIcon />}>
            No goals set yet. Goals are captured in the "Goals & Whys" survey.
          </MuiAlert>
        )}

        {/* Goals Summary Stats */}
        {hasGoals && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {goalCounts.win > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.5,
                  backgroundColor: STATUS_CONFIG.win.bgColor,
                  borderRadius: 1,
                }}
              >
                <WinIcon sx={{ fontSize: 16, color: STATUS_CONFIG.win.color }} />
                <Typography variant="body2" fontWeight="600" color={STATUS_CONFIG.win.color}>
                  {goalCounts.win} {goalCounts.win === 1 ? 'Win' : 'Wins'}
                </Typography>
              </Box>
            )}
            
            {goalCounts.on_track > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.5,
                  backgroundColor: STATUS_CONFIG.on_track.bgColor,
                  borderRadius: 1,
                }}
              >
                <OnTrackIcon sx={{ fontSize: 16, color: STATUS_CONFIG.on_track.color }} />
                <Typography variant="body2" fontWeight="600" color={STATUS_CONFIG.on_track.color}>
                  {goalCounts.on_track} On Track
                </Typography>
              </Box>
            )}
            
            {goalCounts.at_risk > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.5,
                  backgroundColor: STATUS_CONFIG.at_risk.bgColor,
                  borderRadius: 1,
                }}
              >
                <AtRiskIcon sx={{ fontSize: 16, color: STATUS_CONFIG.at_risk.color }} />
                <Typography variant="body2" fontWeight="600" color={STATUS_CONFIG.at_risk.color}>
                  {goalCounts.at_risk} At Risk
                </Typography>
              </Box>
            )}
          </Box>
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
              <Box sx={{ mb: 0 }}>
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
          </>
        )}

        {/* Action Recommendation */}
        {goalCounts.at_risk > 0 && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="textSecondary" fontStyle="italic">
              💡 Tip: At-risk goals may need adjustment or additional support
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

