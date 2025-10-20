'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import type { FoodTriggerAnalysis } from '@/types/database.types';

interface FoodTriggersSectionProps {
  foodTriggers: FoodTriggerAnalysis;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Food Triggers Section Component
 * 
 * Displays 4 food trigger categories:
 * 1. 🚨 High Priority
 * 2. ⚠️ Moderate Priority
 * 3. 📋 Consider Testing
 * 4. 🌱 Likely Safe
 */
export default function FoodTriggersSection({
  foodTriggers,
  isLoading,
  error,
}: FoodTriggersSectionProps) {
  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Analyzing food triggers...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 4 }}>
        <Typography variant="body2">
          Unable to load food trigger analysis
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Food Trigger Analysis
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        {foodTriggers.explanation}
      </Typography>

      <Grid container spacing={2}>
        {foodTriggers.categories.map((category, index) => (
          <Grid key={index} size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                height: '100%',
                borderLeft: 4,
                borderLeftColor: getCategoryColor(category.priority),
              }}
            >
              <CardContent>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {category.title}
                </Typography>
                <List dense sx={{ pt: 0 }}>
                  {category.foods.map((food, foodIndex) => (
                    <ListItem key={foodIndex} sx={{ px: 0, py: 0.5 }}>
                      <ListItemText
                        primary={food}
                        primaryTypographyProps={{
                          variant: 'body2',
                          color: 'textPrimary',
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getCategoryColor(priority: string): string {
  switch (priority) {
    case 'high':
      return '#ef4444'; // Red
    case 'moderate':
      return '#f59e0b'; // Orange
    case 'consider':
      return '#3b82f6'; // Blue
    case 'safe':
      return '#10b981'; // Green
    default:
      return '#6b7280'; // Gray
  }
}

