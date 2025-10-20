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
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  SwapVert as SwapVertIcon,
} from '@mui/icons-material';
import type { MsqDomainCard } from '@/types/database.types';

interface DomainCardsGridProps {
  domains: MsqDomainCard[];
}

/**
 * Domain Cards Grid Component
 * 
 * Displays 10 domain cards, each showing:
 * - Domain name with emoji
 * - Average score and severity
 * - Trend description
 * - List of symptoms with progression (3 colored boxes)
 */
export default function DomainCardsGrid({ domains }: DomainCardsGridProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Body Systems Analysis
      </Typography>

      <Grid container spacing={2}>
        {domains.map((domain, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card 
              sx={{ 
                height: '100%', 
                borderTop: 3, 
                borderTopColor: getSeverityColor(domain.severity),
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

function ExpandableDomainCard({ domain }: { domain: MsqDomainCard }) {
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
        </Box>

        {/* Right: Trend Label + Icon + Expand Arrow */}
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

      {/* Second Row: Score + Severity Assessment */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: expanded ? 2 : 0 }}>
        <Chip
          label={domain.average_score.toFixed(1)}
          size="small"
          sx={{ 
            backgroundColor: getSeverityColor(domain.severity), 
            color: '#fff', 
            fontWeight: 'bold',
            fontSize: '0.75rem',
            height: 24,
          }}
        />
        <Typography 
          variant="caption" 
          sx={{ 
            textTransform: 'capitalize',
            color: getSeverityColor(domain.severity),
            fontWeight: 600,
          }}
        >
          {domain.severity}
        </Typography>
      </Box>

      {/* Expandable Details: Symptom Table */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 1 }}>
          {domain.symptoms.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 1 }}>Symptom</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '0.75rem', minWidth: 100, py: 1 }}>
                      Progress
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {domain.symptoms.map((symptom, sIndex) => (
                    <TableRow key={sIndex}>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75 }}>{symptom.symptom_name}</TableCell>
                      <TableCell align="center" sx={{ py: 0.75 }}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          {symptom.scores.map((score, scoreIdx) => (
                            <Box
                              key={scoreIdx}
                              sx={{
                                width: 22,
                                height: 22,
                                borderRadius: 1,
                                backgroundColor: getScoreColor(score),
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
              No symptoms reported
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
 * Get color for severity level (quartile-based scoring)
 * minimal (0-25%): Green
 * mild (25-50%): Yellow/Orange
 * moderate (50-75%): Orange/Red
 * severe (75-100%): Dark Red
 */
function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'minimal':
    case 'none':
      return '#10b981'; // Green
    case 'mild':
      return '#f59e0b'; // Yellow/Orange
    case 'moderate':
      return '#ef4444'; // Orange/Red
    case 'severe':
      return '#991b1b'; // Dark Red
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Get trend icon based on domain trend type
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
    default:
      return <TrendingFlatIcon sx={{ ...iconStyle, color: '#6b7280' }} />;
  }
}

/**
 * Get trend color for text
 */
function getTrendColor(trend: string): string {
  switch (trend.toLowerCase()) {
    case 'improving':
      return '#10b981'; // Green
    case 'worsening':
      return '#ef4444'; // Red
    case 'stable':
      return '#6b7280'; // Gray
    case 'fluctuating':
      return '#f59e0b'; // Orange
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Get color for individual symptom score (0-4 scale)
 */
function getScoreColor(score: number): string {
  if (score === 0) return '#10b981'; // Green - Never
  if (score === 1) return '#84cc16'; // Light Green - Rarely
  if (score === 2) return '#f59e0b'; // Orange - Sometimes
  if (score === 3) return '#ef4444'; // Red - Frequently
  if (score === 4) return '#991b1b'; // Dark Red - Always
  return '#6b7280'; // Gray - Unknown
}

