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
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  DateRange as DateRangeIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { PromisAssessmentSummary, PromisDomainCard } from '@/types/database.types';
import { interpretMeanTScoreSeverity, getMeanTScoreColor } from '@/lib/utils/promis-assessment';

interface PromisProfileProps {
  summary: PromisAssessmentSummary;
  domains: PromisDomainCard[];
}

/**
 * PROMIS-29 Profile Component
 * 
 * Displays summary card at the top of PROMIS assessment with:
 * - Current mean T-score and severity
 * - Overall trend
 * - Worsening/improving domain counts
 * - Assessment period
 */
export default function PromisProfile({ summary, domains }: PromisProfileProps) {
  const meanTScore = summary.current_mean_t_score;
  const severityLabel = interpretMeanTScoreSeverity(meanTScore);
  const severityColor = getMeanTScoreColor(meanTScore);

  // Filter domains by trend
  const worseningDomains = domains.filter(d => d.trend === 'worsening');
  const improvingDomains = domains.filter(d => d.trend === 'improving');

  // Format assessment period
  const assessmentPeriod = formatAssessmentPeriod(
    summary.period_start,
    summary.period_end,
    summary.assessment_dates.length
  );

  // Get trend icon and color
  const trendConfig = getTrendConfig(summary.total_score_trend, summary.overall_trend_description);

  // Get lighter shade of the severity color for background
  const backgroundColor = `${severityColor}15`; // Add 15 for ~8% opacity

  return (
    <Box sx={{ mb: 4 }}>
      <Card
        variant="outlined"
        sx={{
          borderLeft: 4,
          borderLeftColor: severityColor,
          backgroundColor: backgroundColor,
        }}
      >
        <CardContent>
          <Grid container spacing={2}>
            {/* Current Mean T-Score */}
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
                      Mean T-Score History:
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
                        {new Date(date).toLocaleDateString()}: {summary.all_mean_t_scores[index]?.toFixed(1) || 'N/A'}
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
                      boxShadow: 3,
                      border: 1,
                      borderColor: 'divider',
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
                    {meanTScore.toFixed(1)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: severityColor,
                      fontWeight: 'medium',
                    }}
                  >
                    ({severityLabel})
                  </Typography>
                </Box>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Latest mean T-score
                </Typography>
              </Box>
            </Grid>

            {/* Trend */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                {trendConfig.icon}
                <Typography variant="body2" color="textSecondary" fontWeight="medium">
                  Trend
                </Typography>
              </Box>
              <Tooltip
                title={
                  <Box sx={{ p: 1.5, maxWidth: 350 }}>
                    {summary.assessment_dates.length >= 2 ? (
                      <>
                        {trendConfig.description.split('\n').map((line, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            sx={{
                              fontSize: index === 0 ? '0.85rem' : '0.8rem',
                              fontWeight: index === 0 ? 600 : 400,
                              color: 'text.primary',
                              mb: index === 0 ? 1 : 0,
                            }}
                          >
                            {line}
                          </Typography>
                        ))}
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
                    {trendConfig.label}
                  </Typography>
                  {summary.overall_change_magnitude !== 'N/A' && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: trendConfig.color,
                        fontWeight: 'medium',
                      }}
                    >
                      ({summary.overall_change_magnitude})
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

            {/* Worsening Domains */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TrendingDownIcon sx={{ fontSize: 20, color: 'error.main' }} />
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
                  {summary.worsening_domains_count}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Domains getting worse
                </Typography>
              </Box>
            </Grid>

            {/* Improving Domains */}
            <Grid size={{ xs: 12, sm: 2.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TrendingUpIcon sx={{ fontSize: 20, color: 'success.main' }} />
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
                  {summary.improving_domains_count}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="textSecondary">
                  Domains getting better
                </Typography>
              </Box>
            </Grid>

            {/* Assessment Period */}
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
                {summary.assessment_dates.length} {summary.assessment_dates.length === 1 ? 'assessment' : 'assessments'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

// Helper function to format assessment period
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
  
  // If same date, show single date without count
  if (startDate === endDate) {
    return `${formatDate(start)}`;
  }
  
  // Show date range without count: "12/11/24 - 04/18/25"
  return `${formatDate(start)} - ${formatDate(end)}`;
}

// Helper function to get trend configuration
function getTrendConfig(trend: string, trendDescription: string): {
  icon: React.ReactElement;
  label: string;
  description: string;
  color: string;
} {
  switch (trend) {
    case 'improving':
      return {
        icon: <TrendingUpIcon sx={{ fontSize: 20, color: 'success.main' }} />,
        label: 'Improving',
        description: trendDescription || 'Overall health improving',
        color: '#10b981',
      };
    case 'worsening':
      return {
        icon: <TrendingDownIcon sx={{ fontSize: 20, color: 'error.main' }} />,
        label: 'Worsening',
        description: trendDescription || 'Overall health declining',
        color: '#ef4444',
      };
    case 'stable':
      return {
        icon: <TrendingFlatIcon sx={{ fontSize: 20, color: 'info.main' }} />,
        label: 'Stable',
        description: trendDescription || 'No clinically meaningful change',
        color: '#3b82f6',
      };
    default:
      return {
        icon: <TrendingFlatIcon sx={{ fontSize: 20, color: 'info.main' }} />,
        label: 'Stable',
        description: 'No significant change',
        color: '#06b6d4',
      };
  }
}

