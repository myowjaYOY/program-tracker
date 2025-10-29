'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled,
  StepIconProps,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import type { MemberProgressDashboard } from '@/types/common';

interface TimelineCardProps {
  data: MemberProgressDashboard;
}

// Fallback module sequence for 4-Month AIP Program (program_id = 2)
// Used only if backend doesn't provide module_sequence
// Backend should always provide this from member's actual program
const FALLBACK_MODULE_SEQUENCE = [
  'MODULE 1 - PRE-PROGRAM',
  'MODULE 2 - WEEK 1',
  'MODULE 3 - WEEK 2',
  'MODULE 4 - START OF DETOX',
  'MODULE 5 - WEEK 4',
  'MODULE 6 - MID-DETOX',
  'MODULE 7 - END OF DETOX',
  'MODULE 8 - END OF MONTH 2',
  'MODULE 9 - START OF MONTH 3',
  'MODULE 10 - MID-MONTH 3',
  'MODULE 11 - END OF MONTH 3',
  'MODULE 12 - START OF MONTH 4',
  'MODULE 13 - MID-MONTH 4',
];

/**
 * Custom connector with colored lines
 */
const CustomConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
    left: 'calc(-50% + 22px)',
    right: 'calc(50% + 22px)',
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor: '#e0e0e0',
    borderTopWidth: 3,
    borderRadius: 1,
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    borderColor: '#10b981',
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    borderColor: '#3b82f6',
  },
}));

/**
 * Extract module number from module name
 * E.g., "MODULE 1 - PRE-PROGRAM" → "M1"
 * E.g., "MODULE 13 - MID-MONTH 4" → "M13"
 */
function extractModuleNumber(moduleName: string): string {
  const match = moduleName.match(/MODULE\s+(\d+)/i);
  return match ? `M${match[1]}` : 'M?';
}

/**
 * Extract description from module name and convert to title case
 * E.g., "MODULE 1 - PRE-PROGRAM" → "Pre-Program"
 * E.g., "MODULE 4 - START OF DETOX" → "Start of Detox"
 */
function extractModuleDescription(moduleName: string): string {
  const parts = moduleName.split('-');
  let description = moduleName;
  
  if (parts.length > 1) {
    description = parts.slice(1).join('-').trim();
  }
  
  // Convert to title case (capitalize first letter of each word)
  return description
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format date as "Oct 15"
 */
function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  } catch {
    return null;
  }
}

/**
 * Custom step icon with module number text
 */
interface CustomStepIconProps extends StepIconProps {
  moduleName: string;
  isCompleted: boolean;
  isOverdue: boolean;
  isNext: boolean;
  isFuture: boolean;
}

function CustomStepIcon(props: CustomStepIconProps) {
  const { moduleName, isCompleted, isOverdue, isNext, isFuture } = props;

  // Determine color
  let backgroundColor = '#e0e0e0';
  let textColor = '#9ca3af';
  let borderColor = 'transparent';

  if (isCompleted) {
    backgroundColor = '#10b981';
    textColor = 'white';
  } else if (isOverdue) {
    backgroundColor = '#ef4444';
    textColor = 'white';
    borderColor = '#dc2626';
  } else if (isNext) {
    backgroundColor = '#3b82f6';
    textColor = 'white';
    borderColor = '#2563eb';
  } else if (isFuture) {
    backgroundColor = '#d1d5db';
    textColor = '#9ca3af';
  }

  const moduleNumber = extractModuleNumber(moduleName);

  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        backgroundColor,
        border: borderColor !== 'transparent' ? `3px solid ${borderColor}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'scale(1.1)',
        },
      }}
    >
      <Typography 
        sx={{ 
          color: textColor, 
          fontWeight: 'bold', 
          fontSize: '0.875rem',
        }}
      >
        {moduleNumber}
      </Typography>
    </Box>
  );
}

/**
 * Timeline Card Component
 * 
 * Displays member's progress through the program curriculum as a horizontal timeline
 */
export default function TimelineCard({ data }: TimelineCardProps) {
  // Use module sequence from backend (dynamic based on member's program)
  // Fallback to hardcoded sequence if backend doesn't provide it
  const moduleSequence = data.module_sequence && data.module_sequence.length > 0 
    ? data.module_sequence 
    : FALLBACK_MODULE_SEQUENCE;

  const completedCount = data.completed_milestones.length;
  const overdueCount = data.overdue_milestones.length;

  // Determine the state of each module
  const getModuleState = (moduleName: string, index: number) => {
    const isCompleted = data.completed_milestones.includes(moduleName);
    const isOverdue = data.overdue_milestones.includes(moduleName);
    const isNext = data.next_milestone === moduleName;
    const isFuture = !isCompleted && !isOverdue && !isNext;

    return { isCompleted, isOverdue, isNext, isFuture };
  };

  // Find the active step index (last completed)
  const activeStep = completedCount;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon sx={{ fontSize: 24, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Curriculum Progress
            </Typography>
          </Box>
          
          {/* Progress Summary */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="caption" color="textSecondary">
              <Box component="span" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                {completedCount}
              </Box>
              /{moduleSequence.length} Complete
            </Typography>
            {overdueCount > 0 && (
              <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 'bold' }}>
                {overdueCount} Overdue
              </Typography>
            )}
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} />
            <Typography variant="caption">Completed</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
            <Typography variant="caption">Next</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <Typography variant="caption">Overdue</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#d1d5db' }} />
            <Typography variant="caption">Future</Typography>
          </Box>
        </Box>

        {/* Horizontal Scrollable Timeline */}
        <Box sx={{ 
          overflowX: 'auto', 
          overflowY: 'hidden',
          pb: 2,
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#888',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: '#555',
            },
          },
        }}>
          <Box sx={{ minWidth: 'max-content', px: 2 }}>
            <Stepper 
              activeStep={activeStep} 
              alternativeLabel 
              connector={<CustomConnector />}
              sx={{
                '& .MuiStepLabel-label': {
                  marginTop: 1,
                  fontSize: '0.75rem',
                  maxWidth: 120,
                  wordWrap: 'break-word',
                },
              }}
            >
              {moduleSequence.map((module, index) => {
                const { isCompleted, isOverdue, isNext, isFuture } = getModuleState(module, index);
                const description = extractModuleDescription(module);
                const completionDate = data.module_completion_dates?.[module];
                const formattedDate = formatDate(completionDate);
                
                // Determine top line (date or status)
                let topLine = '';
                if (isCompleted && formattedDate) {
                  topLine = formattedDate; // "Oct 15"
                } else if (isOverdue) {
                  topLine = 'overdue'; // lowercase
                } else {
                  topLine = ''; // Future modules show no date
                }
                
                return (
                  <Step key={module} completed={isCompleted} active={isNext}>
                    <StepLabel
                      StepIconComponent={(props) => (
                        <CustomStepIcon
                          {...props}
                          moduleName={module}
                          isCompleted={isCompleted}
                          isOverdue={isOverdue}
                          isNext={isNext}
                          isFuture={isFuture}
                        />
                      )}
                    >
                      <Box sx={{ textAlign: 'center' }}>
                        {/* Date or Status - ABOVE description */}
                        {topLine && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontSize: '0.75rem',
                              color: 'text.secondary', // Same color for all
                              display: 'block',
                              marginBottom: 0.5,
                            }}
                          >
                            {topLine}
                          </Typography>
                        )}
                        
                        {/* Description - BELOW date */}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontSize: '0.75rem',
                            color: 'text.secondary', // Same color for all
                            display: 'block',
                          }}
                        >
                          {description}
                        </Typography>
                      </Box>
                    </StepLabel>
                  </Step>
                );
              })}
            </Stepper>
          </Box>
        </Box>

        {/* Status Message */}
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          {overdueCount > 0 ? (
            <Typography variant="body2" color="#ef4444" fontWeight="500">
              ⚠️ Member is behind schedule - {overdueCount} {overdueCount === 1 ? 'module' : 'modules'} overdue
            </Typography>
          ) : data.next_milestone === 'Program Complete' ? (
            <Typography variant="body2" color="#10b981" fontWeight="500">
              🎉 Program complete! All modules finished.
            </Typography>
          ) : (
            <Typography variant="body2" color="#10b981" fontWeight="500">
              ✅ On track - Up next: {data.next_milestone}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

