'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Grid,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface InterpretationGuideProps {
  totalScore: number;
  trendInterpretation?: string;
}

/**
 * MSQ Interpretation Guide Component
 * 
 * Displays static reference information:
 * - Score ranges and interpretation
 * - Key patterns to watch for
 * - Patient-specific profile summary
 */
export default function InterpretationGuide({
  totalScore,
  trendInterpretation,
}: InterpretationGuideProps) {
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

  const trendThresholds = [
    {
      change: '≥50 pts or ≥50%',
      direction: 'Decrease',
      interpretation: 'Major transformation',
      description: 'Program success marker',
      color: '#10b981',
    },
    {
      change: '≥30 pts',
      direction: 'Decrease',
      interpretation: 'Significant improvement',
      description: 'Notable functional gains',
      color: '#10b981',
    },
    {
      change: '10-29 pts',
      direction: 'Decrease',
      interpretation: 'Measurable improvement',
      description: 'Clinical progress evident',
      color: '#10b981',
    },
    {
      change: '<10 pts',
      direction: 'Either',
      interpretation: 'Minimal change',
      description: 'Stable condition',
      color: '#3b82f6',
    },
    {
      change: '10-29 pts',
      direction: 'Increase',
      interpretation: 'Measurable worsening',
      description: 'Needs attention',
      color: '#ef4444',
    },
    {
      change: '≥30 pts',
      direction: 'Increase',
      interpretation: 'Significant decline',
      description: 'Intervention recommended',
      color: '#ef4444',
    },
  ];

  const currentLevel = scoreRanges.find((range) => {
    const [min, max] = range.range.includes('+')
      ? [101, 999]
      : range.range.split('-').map(Number);
    return totalScore >= (min ?? 0) && totalScore <= (max ?? 999);
  });

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <InfoOutlinedIcon sx={{ color: 'info.main' }} />
        <Typography variant="h6" fontWeight="bold">
          MSQ Interpretation Guide
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Score Ranges Table */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                MSQ Score Interpretation
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Score</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Level</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Interpretation
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scoreRanges.map((range, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          backgroundColor:
                            range.level === currentLevel?.level
                              ? 'action.selected'
                              : 'inherit',
                        }}
                      >
                        <TableCell>{range.range}</TableCell>
                        <TableCell>
                          <Chip
                            label={range.level}
                            size="small"
                            sx={{
                              backgroundColor: range.color,
                              color: '#fff',
                              fontWeight: 'bold',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>
                          {range.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Trend Interpretation */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Trend Interpretation (First to Last Assessment)
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Change</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Direction</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Interpretation
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        Clinical Meaning
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trendThresholds.map((threshold, index) => (
                      <TableRow 
                        key={index}
                        sx={{
                          backgroundColor:
                            threshold.interpretation === trendInterpretation
                              ? 'action.selected'
                              : 'inherit',
                        }}
                      >
                        <TableCell sx={{ fontSize: '0.75rem' }}>
                          {threshold.change}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>
                          {threshold.direction}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={threshold.interpretation}
                            size="small"
                            sx={{
                              backgroundColor: threshold.color,
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>
                          {threshold.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

