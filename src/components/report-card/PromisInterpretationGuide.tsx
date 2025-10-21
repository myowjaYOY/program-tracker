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
  Chip,
  Grid,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface PromisInterpretationGuideProps {
  currentMeanTScore: number;
  changeMagnitude: string; // 'Minimal Change' | 'Moderate Change' | 'Substantial Change'
}

/**
 * PROMIS-29 Interpretation Guide Component
 * 
 * Displays static reference information:
 * - T-score interpretation (mean=50, SD=10)
 * - Domain types (symptom vs. function)
 * - Severity thresholds
 * 
 * Highlights the current score range and change magnitude
 */
export default function PromisInterpretationGuide({
  currentMeanTScore,
  changeMagnitude,
}: PromisInterpretationGuideProps) {
  const tScoreRanges = [
    {
      range: '< 55',
      symptomLevel: 'Within Normal Limits',
      functionLevel: 'Mild-Severe Limitation',
      color: '#10b981',
      minScore: 0,
      maxScore: 54.9,
    },
    {
      range: '55-59',
      symptomLevel: 'Mild',
      functionLevel: 'Within Normal Limits',
      color: '#f59e0b',
      minScore: 55,
      maxScore: 59.9,
    },
    {
      range: '60-69',
      symptomLevel: 'Moderate',
      functionLevel: 'Within Normal Limits',
      color: '#ef4444',
      minScore: 60,
      maxScore: 69.9,
    },
    {
      range: '70-79',
      symptomLevel: 'Severe',
      functionLevel: 'Within Normal Limits',
      color: '#dc2626',
      minScore: 70,
      maxScore: 79.9,
    },
    {
      range: '≥ 80',
      symptomLevel: 'Very Severe',
      functionLevel: 'Within Normal Limits',
      color: '#991b1b',
      minScore: 80,
      maxScore: 999,
    },
  ];

  // Determine which T-score range the current score falls into
  const currentTScoreRange = tScoreRanges.find(
    (range) => currentMeanTScore >= range.minScore && currentMeanTScore <= range.maxScore
  );

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <InfoOutlinedIcon sx={{ color: 'info.main' }} />
        <Typography variant="h6" fontWeight="bold">
          PROMIS-29 Interpretation Guide
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Card 1: T-Score Interpretation */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                T-Score Interpretation
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                PROMIS T-scores: Mean = 50, Standard Deviation = 10 (U.S. population)
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>T-Score</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Symptom Domains</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Function Domains</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tScoreRanges.map((range, index) => (
                      <TableRow 
                        key={index}
                        sx={{
                          backgroundColor:
                            currentTScoreRange?.range === range.range
                              ? 'action.selected'
                              : 'inherit',
                        }}
                      >
                        <TableCell>
                          <Chip
                            label={range.range}
                            size="small"
                            sx={{
                              backgroundColor: range.color,
                              color: '#fff',
                              fontWeight: 'bold',
                              minWidth: 60,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>
                          {range.symptomLevel}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>
                          {range.functionLevel}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Clinical Significance Thresholds */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Clinical Significance Thresholds
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                Meaningful change thresholds for T-score differences
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>T-Score Change</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Change Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Interpretation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow
                      sx={{
                        backgroundColor:
                          changeMagnitude === 'Minimal Change'
                            ? 'action.selected'
                            : 'inherit',
                      }}
                    >
                      <TableCell>
                        <Chip
                          label="< 5 pts"
                          size="small"
                          sx={{
                            backgroundColor: '#3b82f6',
                            color: '#fff',
                            fontWeight: 'bold',
                            minWidth: 60,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>Minimal Change</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>No clinically meaningful change</TableCell>
                    </TableRow>
                    <TableRow
                      sx={{
                        backgroundColor:
                          changeMagnitude === 'Moderate Change'
                            ? 'action.selected'
                            : 'inherit',
                      }}
                    >
                      <TableCell>
                        <Chip
                          label="5-10 pts"
                          size="small"
                          sx={{
                            backgroundColor: '#f59e0b',
                            color: '#fff',
                            fontWeight: 'bold',
                            minWidth: 60,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>Moderate Change</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>Noticeable change in daily function</TableCell>
                    </TableRow>
                    <TableRow
                      sx={{
                        backgroundColor:
                          changeMagnitude === 'Substantial Change'
                            ? 'action.selected'
                            : 'inherit',
                      }}
                    >
                      <TableCell>
                        <Chip
                          label="> 10 pts"
                          size="small"
                          sx={{
                            backgroundColor: '#10b981',
                            color: '#fff',
                            fontWeight: 'bold',
                            minWidth: 60,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>Substantial Change</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>Significant clinical improvement/decline</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Domain Types */}
        <Grid size={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Domain Types
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                PROMIS-29 includes two types of domains with different interpretations
              </Typography>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" fontWeight="bold" color="error.main" gutterBottom>
                      Symptom Domains (Higher = Worse)
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" display="block">• Anxiety</Typography>
                      <Typography variant="caption" display="block">• Depression</Typography>
                      <Typography variant="caption" display="block">• Fatigue</Typography>
                      <Typography variant="caption" display="block">• Sleep Disturbance</Typography>
                      <Typography variant="caption" display="block">• Pain Interference</Typography>
                      <Typography variant="caption" display="block">• Pain Intensity</Typography>
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="body2" fontWeight="bold" color="success.main" gutterBottom>
                      Function Domains (Higher = Better)
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" display="block">• Physical Function</Typography>
                      <Typography variant="caption" display="block">• Social Roles</Typography>
                    </Box>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2, backgroundColor: 'info.50', borderRadius: 1, border: 1, borderColor: 'info.main', height: '100%' }}>
                    <Typography variant="caption" fontWeight="bold" color="info.main" display="block" gutterBottom>
                      Key Concept
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      A T-score of 60 means you are 1 standard deviation (SD) from the U.S. average. 
                      For symptoms, this indicates more severe symptoms. For function, lower scores indicate more limitation.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Reference */}
              <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="textSecondary">
                  <strong>Reference:</strong> PROMIS Adult Profile Scoring Manual (September 16, 2024) | 
                  HealthMeasures.net | T-scores calibrated to U.S. general population (Mean=50, SD=10)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

