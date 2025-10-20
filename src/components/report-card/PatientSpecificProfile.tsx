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
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as WorseningIcon,
  TrendingUp as ImprovingIcon,
  TrendingFlat as TrendingFlatIcon,
  SwapVert as FluctuatingIcon,
  DateRange as DateRangeIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { MsqDomainCard, MsqAssessmentSummary } from '@/types/database.types';

interface PatientSpecificProfileProps {
  summary: MsqAssessmentSummary;
  allDomains: MsqDomainCard[];
  topDomains: MsqDomainCard[];
}

/**
 * Patient-Specific Profile Component
 * 
 * Displays patient-specific MSQ summary at the top of the assessment
 */
export default function PatientSpecificProfile({
  summary,
  allDomains,
  topDomains,
}: PatientSpecificProfileProps) {
  const totalScore = summary.total_msq_score;
  const scoreRanges = [
    {
      range: '0-10',
      level: 'Optimal',
      description: 'Minimal to no symptoms',
      color: '#10b981',
    },
    {
      range: '11-30',
      level: 'Mild',
      description: 'Occasional symptoms, lifestyle manageable',
      color: '#84cc16',
    },
    {
      range: '31-60',
      level: 'Moderate',
      description: 'Multiple symptoms, needs attention',
      color: '#f59e0b',
    },
    {
      range: '61-100',
      level: 'Severe',
      description: 'Significant burden, intervention needed',
      color: '#ef4444',
    },
    {
      range: '101+',
      level: 'Very Severe',
      description: 'Critical, urgent intervention required',
      color: '#991b1b',
    },
  ];

  const currentLevel = scoreRanges.find((range) => {
    const [min, max] = range.range.includes('+')
      ? [101, 999]
      : range.range.split('-').map(Number);
    return totalScore >= (min ?? 0) && totalScore <= (max ?? 999);
  });

  // Get worsening domains from ALL domains
  const worseningDomains = allDomains.filter(d => d.trend === 'worsening');
  const worseningCount = worseningDomains.length;

  // Get improving domains from ALL domains
  const improvingDomains = allDomains.filter(d => d.trend === 'improving');
  const improvingCount = improvingDomains.length;

  // Format assessment period
  const assessmentPeriod = formatAssessmentPeriod(
    summary.period_start,
    summary.period_end,
    summary.assessment_dates.length
  );

  // Get lighter shade of the severity color for background
  const backgroundColor = currentLevel?.color 
    ? `${currentLevel.color}15` // Add 15 for ~8% opacity
    : '#f3f4f615';

  return (
    <Box sx={{ mb: 4 }}>
      <Card
        variant="outlined"
        sx={{
          borderLeft: 4,
          borderLeftColor: currentLevel?.color || '#6b7280',
          backgroundColor: backgroundColor,
        }}
      >
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <AssessmentIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Current Score
                </Typography>
              </Box>
              <Tooltip 
                title={
                  <Box sx={{ p: 1.5, maxWidth: 300 }}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        mb: 1, 
                        fontWeight: 600,
                        color: 'text.primary',
                      }}
                    >
                      Total MSQ Score History:
                    </Typography>
                    {summary.assessment_dates.map((date, index) => (
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
                        {new Date(date).toLocaleDateString()}: {summary.all_total_scores[index]}
                      </Typography>
                    ))}
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
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    cursor: 'pointer',
                    mb: 0.5,
                    '&:hover .score-text': {
                      color: 'primary.main',
                    }
                  }}
                >
                  <Typography 
                    variant="h6" 
                    fontWeight="bold"
                    className="score-text"
                  >
                    {totalScore}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: currentLevel?.color || 'text.secondary',
                      fontWeight: 'medium',
                    }}
                  >
                    ({currentLevel?.level || 'Unknown'})
                  </Typography>
                </Box>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Latest total MSQ score
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                {getTrendIcon(summary.total_score_trend)}
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Trend
                </Typography>
              </Box>
              <Tooltip 
                title={
                  <Box sx={{ p: 1.5, maxWidth: 350 }}>
                    {summary.all_total_scores.length >= 2 ? (
                      <>
                        <Typography
                          variant="body2"
                          sx={{ 
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'text.primary',
                            mb: 1,
                          }}
                        >
                          Change: {getClinicalChange(summary.all_total_scores[0]!, summary.all_total_scores[summary.all_total_scores.length - 1]!)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ 
                            fontSize: '0.8rem',
                            color: 'text.primary',
                          }}
                        >
                          {getClinicalInterpretation(summary.all_total_scores[0]!, summary.all_total_scores[summary.all_total_scores.length - 1]!)}
                        </Typography>
                      </>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ 
                          fontSize: '0.8rem',
                          color: 'text.secondary',
                        }}
                      >
                        Need at least 2 assessments to calculate trend
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
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    cursor: 'pointer',
                    mb: 0.5,
                    '&:hover .trend-text': {
                      color: 'primary.main',
                    }
                  }}
                >
                  <Typography 
                    variant="h6" 
                    fontWeight="bold"
                    className="trend-text"
                  >
                    {getTrendLabel(summary.total_score_trend)}
                  </Typography>
                  {summary.all_total_scores.length >= 2 && (
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: getTrendColor(summary.total_score_trend),
                        fontWeight: 'medium',
                      }}
                    >
                      ({getTrendDescription(summary.all_total_scores[0]!, summary.all_total_scores[summary.all_total_scores.length - 1]!)})
                    </Typography>
                  )}
                </Box>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  First to last assessment
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <WorseningIcon sx={{ fontSize: 20, color: 'error.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Worsening
                </Typography>
              </Box>
              <Tooltip 
                title={
                  <Box sx={{ p: 1.5, maxWidth: 300 }}>
                    {worseningDomains.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No domains worsening
                      </Typography>
                    ) : (
                      <>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            mb: 1, 
                            fontWeight: 600,
                            color: 'text.primary',
                          }}
                        >
                          Worsening domains:
                        </Typography>
                        {worseningDomains.map((domain, index) => (
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
                            • {domain.domain_label}
                          </Typography>
                        ))}
                      </>
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
                    '&:hover': {
                      color: 'primary.main',
                    }
                  }}
                >
                  {worseningCount}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Body systems getting worse
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <ImprovingIcon sx={{ fontSize: 20, color: 'success.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Improving
                </Typography>
              </Box>
              <Tooltip 
                title={
                  <Box sx={{ p: 1.5, maxWidth: 300 }}>
                    {improvingDomains.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No domains improving
                      </Typography>
                    ) : (
                      <>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            mb: 1, 
                            fontWeight: 600,
                            color: 'text.primary',
                          }}
                        >
                          Improving domains:
                        </Typography>
                        {improvingDomains.map((domain, index) => (
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
                            • {domain.domain_label}
                          </Typography>
                        ))}
                      </>
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
                    '&:hover': {
                      color: 'primary.main',
                    }
                  }}
                >
                  {improvingCount}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Body systems getting better
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <DateRangeIcon sx={{ fontSize: 20, color: 'info.main' }} />
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Assessment Period
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                {assessmentPeriod}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Date range (count)
              </Typography>
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

function formatAssessmentPeriod(
  startDate: string,
  endDate: string,
  assessmentCount: number
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Helper function to format date as MM/DD/YY
  const formatDate = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };
  
  // If same date, show single date with count
  if (startDate === endDate) {
    return `${formatDate(start)} (${assessmentCount})`;
  }
  
  // Show date range: "12/11/24 - 04/18/25 (4)"
  return `${formatDate(start)} - ${formatDate(end)} (${assessmentCount})`;
}

function getClinicalChange(firstScore: number, lastScore: number): string {
  const change = lastScore - firstScore;
  const percentChange = firstScore > 0 ? Math.abs((change / firstScore) * 100) : 0;
  
  if (change < 0) {
    return `-${Math.abs(change)} points (${percentChange.toFixed(0)}% reduction)`;
  } else if (change > 0) {
    return `+${change} points (${percentChange.toFixed(0)}% increase)`;
  }
  return 'No change';
}

function getClinicalInterpretation(firstScore: number, lastScore: number): string {
  const change = lastScore - firstScore;
  const percentChange = firstScore > 0 ? (change / firstScore) * 100 : 0;
  
  // Improvement (negative change)
  if (change <= -50 || percentChange <= -50) {
    return '🎉 Major transformation - program success marker';
  } else if (change <= -30) {
    return '✅ Significant functional improvement';
  } else if (change <= -10) {
    return '📈 Measurable clinical improvement';
  }
  
  // Worsening (positive change)
  if (change >= 30) {
    return '⚠️ Significant functional decline';
  } else if (change >= 10) {
    return '⚠️ Measurable clinical worsening';
  }
  
  // Stable
  return 'Stable - minimal change';
}

function getTrendIcon(trend: 'improving' | 'worsening' | 'stable' | 'fluctuating'): React.JSX.Element {
  switch (trend) {
    case 'improving':
      return <TrendingUpIcon sx={{ fontSize: 20, color: 'success.main' }} />;
    case 'worsening':
      return <WorseningIcon sx={{ fontSize: 20, color: 'error.main' }} />;
    case 'fluctuating':
      return <FluctuatingIcon sx={{ fontSize: 20, color: 'warning.main' }} />;
    case 'stable':
    default:
      return <TrendingFlatIcon sx={{ fontSize: 20, color: 'info.main' }} />;
  }
}

function getTrendLabel(trend: 'improving' | 'worsening' | 'stable' | 'fluctuating'): string {
  switch (trend) {
    case 'improving':
      return 'Improving';
    case 'worsening':
      return 'Worsening';
    case 'fluctuating':
      return 'Fluctuating';
    case 'stable':
    default:
      return 'Stable';
  }
}

function getTrendColor(trend: 'improving' | 'worsening' | 'stable' | 'fluctuating'): string {
  switch (trend) {
    case 'improving':
      return '#10b981'; // success.main
    case 'worsening':
      return '#ef4444'; // error.main
    case 'fluctuating':
      return '#f59e0b'; // warning.main
    case 'stable':
    default:
      return '#3b82f6'; // info.main
  }
}

function getTrendDescription(firstScore: number, lastScore: number): string {
  const change = lastScore - firstScore;
  const percentChange = firstScore > 0 ? (change / firstScore) * 100 : 0;
  
  // Improvement (negative change)
  if (change <= -50 || percentChange <= -50) {
    return 'Major transformation';
  } else if (change <= -30) {
    return 'Significant improvement';
  } else if (change <= -10) {
    return 'Measurable improvement';
  }
  
  // Worsening (positive change)
  if (change >= 30) {
    return 'Significant decline';
  } else if (change >= 10) {
    return 'Measurable worsening';
  }
  
  // Stable
  return 'Minimal change';
}

