'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
} from '@mui/material';
import {
  Lightbulb as ImprovementIcon,
  School as EducationIcon,
  SentimentSatisfied as SentimentIcon,
  FormatQuote as QuoteIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import type { FeedbackEntry, FeedbackCategory } from '@/lib/hooks/use-member-feedback';

interface FeedbackTimelineProps {
  feedback: FeedbackEntry[];
}

/**
 * Category configuration for icons and colors
 */
const CATEGORY_CONFIG: Record<
  FeedbackCategory,
  { icon: React.ElementType; color: string; label: string; bgColor: string }
> = {
  improvement: {
    icon: ImprovementIcon,
    color: '#f59e0b', // amber
    label: 'Improvement',
    bgColor: '#fef3c7',
  },
  education: {
    icon: EducationIcon,
    color: '#8b5cf6', // purple
    label: 'Education',
    bgColor: '#ede9fe',
  },
  sentiment: {
    icon: SentimentIcon,
    color: '#06b6d4', // cyan
    label: 'Sentiment',
    bgColor: '#cffafe',
  },
};

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Individual Feedback Item Component
 */
interface FeedbackItemDisplayProps {
  category: FeedbackCategory;
  questionText: string;
  text: string;
}

function FeedbackItemDisplay({ category, questionText, text }: FeedbackItemDisplayProps) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  return (
    <Box
      sx={{
        py: 2,
        '&:not(:last-child)': {
          borderBottom: 1,
          borderColor: 'divider',
        },
      }}
    >
      {/* Category Chip */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
          icon={<Icon sx={{ fontSize: 16 }} />}
          label={config.label}
          size="small"
          sx={{
            backgroundColor: config.bgColor,
            color: config.color,
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 24,
            '& .MuiChip-icon': {
              color: config.color,
            },
          }}
        />
      </Box>

      {/* Question Context */}
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{
          display: 'block',
          mb: 1,
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}
      >
        Q: {questionText}
      </Typography>

      {/* Member's Response */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          pl: 1,
          borderLeft: 3,
          borderColor: config.color,
          backgroundColor: `${config.color}08`,
          py: 1.5,
          px: 2,
          borderRadius: '0 8px 8px 0',
        }}
      >
        <QuoteIcon
          sx={{
            fontSize: 18,
            color: config.color,
            opacity: 0.6,
            flexShrink: 0,
            mt: 0.25,
          }}
        />
        <Typography
          variant="body2"
          sx={{
            lineHeight: 1.6,
            color: 'text.primary',
          }}
        >
          {text || <em style={{ color: '#9ca3af' }}>No response provided</em>}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Survey Session Group Component
 */
interface SessionGroupProps {
  entry: FeedbackEntry;
  isFirst: boolean;
}

function SessionGroup({ entry, isFirst }: SessionGroupProps) {
  return (
    <Box sx={{ mb: 3 }}>
      {/* Session Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          pb: 1,
          borderBottom: 2,
          borderColor: 'primary.main',
        }}
      >
        <CalendarIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
          {formatDate(entry.date)}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          •
        </Typography>
        <Typography variant="caption" color="textSecondary" fontWeight="medium">
          {entry.formName}
        </Typography>
      </Box>

      {/* Feedback Items */}
      <Box sx={{ pl: 1 }}>
        {entry.items.map((item, index) => (
          <FeedbackItemDisplay
            key={`${entry.date}-${item.category}-${index}`}
            category={item.category}
            questionText={item.questionText}
            text={item.text}
          />
        ))}
      </Box>
    </Box>
  );
}

/**
 * Feedback Timeline Component
 * 
 * Displays member text feedback chronologically, grouped by survey session.
 * Shows improvement suggestions, education requests, and program sentiment.
 */
export default function FeedbackTimeline({ feedback }: FeedbackTimelineProps) {
  // Sort feedback by date (newest first)
  const sortedFeedback = [...feedback].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Count total feedback items
  const totalItems = feedback.reduce((sum, entry) => sum + entry.items.length, 0);

  // No feedback state
  if (feedback.length === 0 || totalItems === 0) {
    return (
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <QuoteIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="textSecondary">
              No text feedback available yet
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Feedback will appear here when the member completes surveys with open-ended questions
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="h3" fontWeight="bold">
              💬 Feedback Timeline
            </Typography>
          </Box>
          <Typography variant="caption" color="textSecondary">
            {totalItems} {totalItems === 1 ? 'response' : 'responses'} from{' '}
            {feedback.length} {feedback.length === 1 ? 'survey' : 'surveys'}
          </Typography>
        </Box>

        {/* Legend */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 3,
            flexWrap: 'wrap',
          }}
        >
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Box
                key={key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Icon sx={{ fontSize: 16, color: config.color }} />
                <Typography variant="caption" color="textSecondary">
                  {config.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Timeline Entries */}
        {sortedFeedback.map((entry, index) => (
          <SessionGroup
            key={`${entry.date}-${entry.formName}`}
            entry={entry}
            isFirst={index === 0}
          />
        ))}
      </CardContent>
    </Card>
  );
}



