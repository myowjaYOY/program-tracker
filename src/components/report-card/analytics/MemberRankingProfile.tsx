'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Leaderboard as LeaderboardIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Route as RouteIcon,
  Flag as FlagIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { IndividualInsights } from '@/lib/hooks/use-individual-insights';

interface MemberRankingProfileProps {
  insights: IndividualInsights;
}

/**
 * Member Ranking Profile Component
 * 
 * Displays member ranking summary at the top of analytics tab
 * Follows same pattern as PatientSpecificProfile and PromisProfile
 */
export default function MemberRankingProfile({ insights }: MemberRankingProfileProps) {
  // Get ordinal suffix for numbers (1st, 2nd, 3rd, 4th, etc.)
  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return `${num}st`;
    if (j === 2 && k !== 12) return `${num}nd`;
    if (j === 3 && k !== 13) return `${num}rd`;
    return `${num}th`;
  };

  // Get risk level details
  const getRiskDetails = (riskLevel: string) => {
    switch (riskLevel) {
      case 'green':
        return {
          label: 'Low Risk',
          color: '#10b981', // success.main
          icon: <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />,
        };
      case 'yellow':
        return {
          label: 'Medium Risk',
          color: '#f59e0b', // warning.main
          icon: <WarningIcon sx={{ fontSize: 20, color: 'warning.main' }} />,
        };
      case 'red':
        return {
          label: 'High Risk',
          color: '#ef4444', // error.main
          icon: <WarningIcon sx={{ fontSize: 20, color: 'error.main' }} />,
        };
      default:
        return {
          label: 'Unknown',
          color: '#6b7280', // grey
          icon: <WarningIcon sx={{ fontSize: 20, color: 'text.secondary' }} />,
        };
    }
  };

  // Get journey pattern details
  const getJourneyDetails = (pattern: string) => {
    switch (pattern) {
      case 'success_stories':
        return { 
          label: 'Success Stories', 
          description: 'High compliance + improving health',
          color: '#10b981' // success
        };
      case 'motivational_support':
        return { 
          label: 'Motivational Support', 
          description: 'Low compliance but improving',
          color: '#f59e0b' // warning
        };
      case 'clinical_attention':
        return { 
          label: 'Clinical Attention', 
          description: 'High compliance but not improving',
          color: '#3b82f6' // info
        };
      case 'high_priority':
        return { 
          label: 'High Priority', 
          description: 'Low compliance + worsening health',
          color: '#ef4444' // error
        };
      default:
        return { 
          label: 'Unknown', 
          description: '',
          color: '#6b7280' // grey
        };
    }
  };

  const riskDetails = getRiskDetails(insights.risk_level);
  const journeyDetails = getJourneyDetails(insights.journey_pattern);

  // Format risk factors for display
  const riskFactorsText = insights.risk_factors && insights.risk_factors.length > 0
    ? insights.risk_factors.join(', ')
    : 'None identified';

  // Get quartile color
  const getQuartileColor = (quartile: number): string => {
    switch (quartile) {
      case 1: return '#10b981'; // green - top 25%
      case 2: return '#84cc16'; // lime - top 50%
      case 3: return '#f59e0b'; // orange - bottom 50%
      case 4: return '#ef4444'; // red - bottom 25%
      default: return '#6b7280'; // grey
    }
  };

  const quartileColor = getQuartileColor(insights.quartile);
  const backgroundColor = `${quartileColor}15`; // Add 15 for ~8% opacity

  return (
    <Box sx={{ mb: 4 }}>
      <Card
        variant="outlined"
        sx={{
          borderLeft: 4,
          borderLeftColor: quartileColor,
          backgroundColor: backgroundColor,
        }}
      >
        <CardContent>
          <Grid container spacing={2}>
            {/* Population Ranking */}
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <LeaderboardIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Population Ranking
                </Typography>
              </Box>
              <Tooltip
                title={
                  <Box sx={{ p: 1.5, maxWidth: 350 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        mb: 1,
                        fontWeight: 600,
                        color: 'text.primary',
                      }}
                    >
                      Quartile {insights.quartile} - {getQuartileDescription(insights.quartile)}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.8rem',
                        color: 'text.primary',
                      }}
                    >
                      {getQuartileExplanation(insights.quartile)}
                    </Typography>
                  </Box>
                }
                placement="top"
                arrow
                enterDelay={300}
                leaveDelay={200}
                componentsProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: 3,
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
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{
                    mb: 0.5,
                    cursor: 'pointer',
                    '&:hover': {
                      color: 'primary.main',
                    }
                  }}
                >
                  Q{insights.quartile}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Rank #{insights.rank_in_population} of {insights.total_members_in_population} members
                </Typography>
              </Box>
            </Grid>

            {/* Risk Assessment */}
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                {riskDetails.icon}
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Risk Assessment
                </Typography>
              </Box>
              <Tooltip
                title={
                  <Box sx={{ p: 1.5, maxWidth: 400 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        mb: 1,
                        fontWeight: 600,
                        color: 'text.primary',
                      }}
                    >
                      Status Score Calculation:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.8rem',
                        color: 'text.primary',
                        mb: 1,
                      }}
                    >
                      • Compliance: 35 points{'\n'}
                      • Curriculum Progress: 35 points{'\n'}
                      • Health Vitals: 20 points{'\n'}
                      • Wins: 5 points{'\n'}
                      • Challenges: 5 points
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'text.primary',
                      }}
                    >
                      {getRiskLevelDescription(insights.risk_level, insights.risk_score)}
                    </Typography>
                  </Box>
                }
                placement="top"
                arrow
                enterDelay={300}
                leaveDelay={200}
                componentsProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: 3,
                      whiteSpace: 'pre-line',
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
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    mb: 0.5,
                    '&:hover .risk-text': {
                      color: 'primary.main',
                    }
                  }}
                >
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    className="risk-text"
                  >
                    {insights.risk_score}/100
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: riskDetails.color,
                      fontWeight: 'medium',
                    }}
                  >
                    ({riskDetails.label})
                  </Typography>
                </Box>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Overall status score
                </Typography>
              </Box>
            </Grid>

            {/* Journey Pattern */}
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <RouteIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Journey Pattern
                </Typography>
              </Box>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{
                  mb: 0.5,
                  color: journeyDetails.color,
                }}
              >
                {journeyDetails.label}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {journeyDetails.description}
              </Typography>
            </Grid>

            {/* Risk Factors */}
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <FlagIcon sx={{ fontSize: 20, color: insights.risk_factors.length > 0 ? 'error.main' : 'success.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Risk Factors
                </Typography>
              </Box>
              <Tooltip
                title={
                  <Box sx={{ p: 1.5, maxWidth: 350 }}>
                    {insights.risk_factors && insights.risk_factors.length > 0 ? (
                      <>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            mb: 1,
                            fontWeight: 600,
                            color: 'text.primary',
                          }}
                        >
                          Identified Risk Factors:
                        </Typography>
                        {insights.risk_factors.map((factor, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            sx={{
                              mb: 0.5,
                              fontSize: '0.8rem',
                              lineHeight: 1.3,
                              color: 'text.primary',
                            }}
                          >
                            • {factor}
                          </Typography>
                        ))}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No risk factors identified - member is on track!
                      </Typography>
                    )}
                  </Box>
                }
                placement="top"
                arrow
                enterDelay={300}
                leaveDelay={200}
                componentsProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: 3,
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
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{
                    mb: 0.5,
                    cursor: 'pointer',
                    color: insights.risk_factors.length > 0 ? 'error.main' : 'success.main',
                    '&:hover': {
                      color: 'primary.main',
                    }
                  }}
                >
                  {insights.risk_factors.length}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  {insights.risk_factors.length === 0 ? 'On track' : 'Needs attention'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getQuartileDescription(quartile: number): string {
  switch (quartile) {
    case 1: return 'Top 25%';
    case 2: return 'Top 50%';
    case 3: return 'Bottom 50%';
    case 4: return 'Bottom 25%';
    default: return 'Unknown';
  }
}

function getQuartileExplanation(quartile: number): string {
  switch (quartile) {
    case 1:
      return 'This member ranks in the top quarter of all members. Excellent performance across compliance and health metrics.';
    case 2:
      return 'This member ranks in the second quarter. Above-average performance with room for improvement.';
    case 3:
      return 'This member ranks in the third quarter. Below-average performance - may need additional support.';
    case 4:
      return 'This member ranks in the bottom quarter. Significant support needed to improve outcomes.';
    default:
      return 'Member ranking within the population based on overall status score.';
  }
}

function getRiskLevelDescription(riskLevel: string, score: number): string {
  switch (riskLevel) {
    case 'green':
      return 'Low Risk (≥70): Member is meeting expectations across compliance, curriculum, and health vitals. Continue current approach.';
    case 'yellow':
      return 'Medium Risk (40-69): Some areas need attention. Review compliance gaps, curriculum progress, and health trends. Targeted support recommended.';
    case 'red':
      return 'High Risk (<40): Urgent intervention needed. Multiple areas significantly below target. Immediate coordinator action required.';
    default:
      return 'Risk level could not be determined.';
  }
}



