'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  SwapVert as SwapVertIcon,
} from '@mui/icons-material';
import type { PromisDomainCard } from '@/types/database.types';
import { 
  getSeverityLabel, 
  getSeverityColor,
  sortPromisDomains,
} from '@/lib/utils/promis-assessment';

interface PromisDomainCardsGridProps {
  domains: PromisDomainCard[];
}

/**
 * PROMIS Domain Cards Grid Component
 * 
 * Displays 8 PROMIS-29 domain cards (3 per row), each showing:
 * - Domain name with emoji
 * - Current T-score and severity
 * - Trend icon
 * - Expandable question-level details
 */
export default function PromisDomainCardsGrid({ domains }: PromisDomainCardsGridProps) {
  // Sort domains alphabetically
  const sortedDomains = sortPromisDomains(domains);

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Health Domains Analysis
      </Typography>

      <Grid container spacing={2}>
        {sortedDomains.map((domain, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card 
              sx={{ 
                height: '100%', 
                borderTop: 3, 
                borderTopColor: getSeverityColor(domain.current_severity),
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 2, flexGrow: 1, '&:last-child': { pb: 2 } }}>
                <ExpandableDomainCard domain={domain} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function ExpandableDomainCard({ domain }: { domain: PromisDomainCard }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded(!expanded);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Row: Icon, Name, Trend, Expand/Collapse */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 1.5,
        }}
      >
        {/* Left: Icon + Name */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 20, flexShrink: 0 }}>{domain.emoji}</Typography>
          {domain.domain_key === 'pain_intensity' ? (
            <Tooltip 
              title="Pain Intensity uses a 0-10 scale: 0 = No pain, 1-3 = Mild, 4-6 = Moderate, 7-9 = Severe, 10 = Worst imaginable pain"
              arrow
              placement="top"
            >
              <Typography 
                variant="subtitle2" 
                fontWeight="bold"
                sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'help',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                }}
              >
                {domain.domain_label}
              </Typography>
            </Tooltip>
          ) : (
            <Typography 
              variant="subtitle2" 
              fontWeight="bold"
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {domain.domain_label}
            </Typography>
          )}
        </Box>

        {/* Right: Trend Icon + Expand Arrow */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Typography variant="caption" color="textSecondary" fontWeight="600">
            Trend:
          </Typography>
          {getTrendIcon(domain.trend)}
          <IconButton 
            size="small" 
            onClick={toggle}
            sx={{ p: 0.5 }}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {/* Second Row: T-Score + Severity Assessment */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: expanded ? 2 : 0 }}>
        <Chip
          label={
            domain.domain_key === 'pain_intensity' 
              ? `${domain.current_raw_score}/10` 
              : domain.current_t_score !== null 
                ? `T: ${domain.current_t_score.toFixed(0)}` 
                : 'N/A'
          }
          size="small"
          sx={{ 
            backgroundColor: getSeverityColor(domain.current_severity), 
            color: '#fff', 
            fontWeight: 'bold',
            fontSize: '0.75rem',
            height: 24,
          }}
        />
        <Typography 
          variant="caption" 
          sx={{ 
            color: getSeverityColor(domain.current_severity),
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          {getSeverityLabel(domain.current_severity)}
        </Typography>
      </Box>

      {/* Expandable Details: Question Table */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 1 }}>
          {domain.questions.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 1 }}>Question</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '0.75rem', minWidth: 100, py: 1 }}>
                      Progress
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {domain.questions.map((question, qIndex) => (
                    <TableRow key={qIndex}>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75 }}>{question.question_text}</TableCell>
                      <TableCell align="center" sx={{ py: 0.75 }}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          {question.all_raw_scores.map((score: number, scoreIdx: number) => (
                            <Box
                              key={scoreIdx}
                              sx={{
                                width: 22,
                                height: 22,
                                borderRadius: 1,
                                backgroundColor: getQuestionScoreColor(score, domain.domain_key),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: '0.625rem',
                                fontWeight: 'bold',
                              }}
                            >
                              {score}
                            </Box>
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic', textAlign: 'center', display: 'block', py: 2 }}>
              No questions reported
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get color for individual question score (1-5 scale for most, 0-10 for pain intensity)
 * PROMIS uses 1-5 scale: Never, Rarely, Sometimes, Often, Always
 * Pain Intensity uses 0-10 scale
 * 
 * IMPORTANT: Function domains (physical_function, social_roles) use REVERSED colors
 * because higher scores = better function
 */
function getQuestionScoreColor(score: number, domainKey: string): string {
  // Pain Intensity uses 0-10 scale (symptom: lower = better)
  if (domainKey === 'pain_intensity') {
    if (score === 0) return '#10b981'; // Green - No pain
    if (score <= 3) return '#84cc16'; // Light Green - Mild
    if (score <= 6) return '#f59e0b'; // Orange - Moderate
    if (score <= 8) return '#ef4444'; // Red - Severe
    return '#991b1b'; // Dark Red - Very severe (9-10)
  }
  
  // Function domains: Higher score = BETTER (green)
  if (domainKey === 'physical_function' || domainKey === 'social_roles') {
    if (score === 5) return '#10b981'; // Green - Very much (good!)
    if (score === 4) return '#84cc16'; // Light Green - Quite a bit
    if (score === 3) return '#f59e0b'; // Orange - Somewhat
    if (score === 2) return '#ef4444'; // Red - A little bit
    if (score === 1) return '#991b1b'; // Dark Red - Not at all
    return '#6b7280'; // Gray - Unknown
  }
  
  // Symptom domains: Lower score = BETTER (green)
  if (score === 1) return '#10b981'; // Green - Never/Not at all
  if (score === 2) return '#84cc16'; // Light Green - Rarely/A little bit
  if (score === 3) return '#f59e0b'; // Orange - Sometimes/Somewhat
  if (score === 4) return '#ef4444'; // Red - Often/Quite a bit
  if (score === 5) return '#991b1b'; // Dark Red - Always/Very much
  return '#6b7280'; // Gray - Unknown
}

/**
 * Get trend icon (matching MSQ style)
 */
function getTrendIcon(trend: string): React.JSX.Element {
  const iconStyle = { fontSize: 16 };
  
  switch (trend.toLowerCase()) {
    case 'improving':
      return <TrendingUpIcon sx={{ ...iconStyle, color: '#10b981' }} />;
    case 'worsening':
      return <TrendingDownIcon sx={{ ...iconStyle, color: '#ef4444' }} />;
    case 'stable':
      return <TrendingFlatIcon sx={{ ...iconStyle, color: '#6b7280' }} />;
    case 'fluctuating':
      return <SwapVertIcon sx={{ ...iconStyle, color: '#f59e0b' }} />;
    case 'insufficient_data':
      return <TrendingFlatIcon sx={{ ...iconStyle, color: '#9ca3af' }} />;
    default:
      return <TrendingFlatIcon sx={{ ...iconStyle, color: '#6b7280' }} />;
  }
}

