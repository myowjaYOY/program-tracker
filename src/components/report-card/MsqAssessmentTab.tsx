'use client';

import React from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useMsqAssessmentData } from '@/lib/hooks/use-msq-assessment';
import PatientSpecificProfile from './PatientSpecificProfile';
import DomainCardsGrid from './DomainCardsGrid';
import InterpretationGuide from './InterpretationGuide';

interface MsqAssessmentTabProps {
  selectedMemberId: number | null;
}

/**
 * MSQ Assessment Tab
 * 
 * Main tab for MSQ-95 clinical dashboard showing:
 * - Member header with 4 summary cards
 * - 3 clinical alert cards
 * - 10 domain cards with symptom progression
 * - Food trigger analysis (4 categories)
 * - AI-generated clinical action plan
 * - MSQ interpretation guide
 */
export default function MsqAssessmentTab({ selectedMemberId }: MsqAssessmentTabProps) {
  // Fetch complete MSQ assessment data
  const {
    summary,
    domains,
    isLoading,
    error,
  } = useMsqAssessmentData(selectedMemberId, false);

  return (
    <Box>

      {/* Empty State - No Member Selected */}
      {!selectedMemberId && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 2,
            backgroundColor: 'background.paper',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Select a Member
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Choose a member from the dropdown above to view their MSQ clinical
            assessment
          </Typography>
        </Box>
      )}

      {/* Loading State */}
      {selectedMemberId && isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            Loading MSQ assessment...
          </Typography>
        </Box>
      )}

      {/* Error State */}
      {selectedMemberId && error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold">
            Error loading assessment data
          </Typography>
          <Typography variant="body2">{error.message}</Typography>
        </Alert>
      )}

      {/* Assessment Content */}
      {selectedMemberId && !isLoading && summary && domains && (
        <Box>
          {/* Patient-Specific Profile Card - At Top */}
          <PatientSpecificProfile
            summary={summary}
            allDomains={domains}
            topDomains={domains
              .filter((d) => d.average_score > 0)
              .sort((a, b) => b.average_score - a.average_score)
              .slice(0, 3)}
          />

          {/* Domain Cards Grid (15 domains) */}
          <DomainCardsGrid domains={domains} />

          {/* MSQ Interpretation Guide */}
          <InterpretationGuide
            totalScore={summary.total_msq_score}
            trendInterpretation={getTrendInterpretation(summary.all_total_scores)}
          />
        </Box>
      )}
    </Box>
  );
}

// Helper function to get trend interpretation
function getTrendInterpretation(allTotalScores: number[]): string | undefined {
  if (allTotalScores.length < 2) {
    return undefined;
  }
  
  const firstScore = allTotalScores[0]!;
  const lastScore = allTotalScores[allTotalScores.length - 1]!;
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

