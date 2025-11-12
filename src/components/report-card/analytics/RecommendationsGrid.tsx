'use client';

import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Chip } from '@mui/material';
import { PriorityHigh, Info, CheckCircle } from '@mui/icons-material';

interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  current_state: string;
  impact: string;
  action: string;
}

interface RecommendationsGridProps {
  recommendations: AIRecommendation[];
}

/**
 * Recommendations Grid Component
 * 
 * Displays AI-powered recommendations in a grid layout:
 * - High priority: Full width cards (red styling)
 * - Medium priority: Half width cards, 2 per row (orange styling)
 * - Low priority: Half width cards, 2 per row (blue styling)
 */
export default function RecommendationsGrid({ recommendations }: RecommendationsGridProps) {
  // Group recommendations by priority
  const highPriority = recommendations.filter(r => r.priority === 'high');
  const mediumPriority = recommendations.filter(r => r.priority === 'medium');
  const lowPriority = recommendations.filter(r => r.priority === 'low');

  if (recommendations.length === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Recommendations
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body2" color="textSecondary">
              No specific recommendations at this time. Member appears to be on track!
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Recommendations
      </Typography>

      <Grid container spacing={2}>
        {/* High Priority - Full Width Cards */}
        {highPriority.map((rec, index) => (
          <Grid size={12} key={`high-${index}`}>
            <RecommendationCard recommendation={rec} />
          </Grid>
        ))}

        {/* Medium Priority - Half Width Cards */}
        {mediumPriority.map((rec, index) => (
          <Grid size={{ xs: 12, md: 6 }} key={`medium-${index}`}>
            <RecommendationCard recommendation={rec} />
          </Grid>
        ))}

        {/* Low Priority - Half Width Cards */}
        {lowPriority.map((rec, index) => (
          <Grid size={{ xs: 12, md: 6 }} key={`low-${index}`}>
            <RecommendationCard recommendation={rec} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ============================================
// RECOMMENDATION CARD COMPONENT
// ============================================

interface RecommendationCardProps {
  recommendation: AIRecommendation;
}

function RecommendationCard({ recommendation }: RecommendationCardProps) {
  // Get priority styling
  const getPriorityDetails = (priority: string) => {
    switch (priority) {
      case 'high':
        return {
          label: 'HIGH PRIORITY',
          color: '#ef4444', // error.main (red)
          icon: <PriorityHigh sx={{ fontSize: 20 }} />,
          emoji: '🚨',
        };
      case 'medium':
        return {
          label: 'MEDIUM PRIORITY',
          color: '#f59e0b', // warning.main (orange)
          icon: <Info sx={{ fontSize: 20 }} />,
          emoji: '⚠️',
        };
      case 'low':
        return {
          label: 'LOW PRIORITY',
          color: '#3b82f6', // info.main (blue)
          icon: <CheckCircle sx={{ fontSize: 20 }} />,
          emoji: '💡',
        };
      default:
        return {
          label: 'PRIORITY',
          color: '#6b7280',
          icon: <Info sx={{ fontSize: 20 }} />,
          emoji: 'ℹ️',
        };
    }
  };

  const details = getPriorityDetails(recommendation.priority);

  return (
    <Card
      sx={{
        height: '100%',
        borderTop: 3,
        borderTopColor: details.color,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header: Emoji + Title + Priority Badge */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
          <Typography sx={{ fontSize: 24, flexShrink: 0 }}>{details.emoji}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={details.label}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  backgroundColor: `${details.color}15`,
                  color: details.color,
                  border: 1,
                  borderColor: details.color,
                }}
              />
            </Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold"
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {recommendation.title}
            </Typography>
          </Box>
        </Box>

        {/* Content Sections */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Current State */}
          <Box>
            <Typography 
              variant="caption" 
              fontWeight={600} 
              color="textSecondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Current State
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {recommendation.current_state}
            </Typography>
          </Box>

          {/* Impact */}
          <Box>
            <Typography 
              variant="caption" 
              fontWeight={600} 
              color="textSecondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Impact
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {recommendation.impact}
            </Typography>
          </Box>

          {/* Recommended Action - Highlighted Box */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: `${details.color}08`,
              borderRadius: 1,
              border: 1,
              borderColor: `${details.color}40`,
            }}
          >
            <Typography 
              variant="caption" 
              fontWeight={600}
              sx={{ 
                textTransform: 'uppercase', 
                letterSpacing: 0.5,
                color: details.color,
              }}
            >
              → Recommended Action
            </Typography>
            <Typography 
              variant="body2" 
              fontWeight={600}
              sx={{ mt: 0.5 }}
            >
              {recommendation.action}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}



