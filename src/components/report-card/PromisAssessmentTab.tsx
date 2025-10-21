'use client';

import React from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { usePromisAssessmentData } from '@/lib/hooks/use-promis-assessment';
import PromisProfile from './PromisProfile';
import PromisDomainCardsGrid from './PromisDomainCardsGrid';
import PromisInterpretationGuide from './PromisInterpretationGuide';

interface PromisAssessmentTabProps {
  selectedMemberId: number | null;
}

/**
 * PROMIS-29 Assessment Tab
 * 
 * Main tab for PROMIS-29 health assessment showing:
 * - Summary profile card (mean T-score, trends, domain counts)
 * - 8 domain cards with T-scores and question details
 * - PROMIS interpretation guide
 */
export default function PromisAssessmentTab({ selectedMemberId }: PromisAssessmentTabProps) {
  // Fetch complete PROMIS assessment data
  const {
    summary,
    domains,
    isLoading,
    error,
  } = usePromisAssessmentData(selectedMemberId);

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
            Choose a member from the dropdown above to view their PROMIS-29 health assessment
          </Typography>
        </Box>
      )}

      {/* Loading State */}
      {selectedMemberId && isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            Loading PROMIS-29 assessment...
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
          {/* PROMIS Profile Card - At Top */}
          <PromisProfile summary={summary} domains={domains} />

          {/* Domain Cards Grid (8 domains, 3 per row) */}
          <PromisDomainCardsGrid domains={domains} />

          {/* PROMIS Interpretation Guide */}
          <PromisInterpretationGuide 
            currentMeanTScore={summary.current_mean_t_score}
            changeMagnitude={summary.overall_change_magnitude}
          />
        </Box>
      )}
    </Box>
  );
}

