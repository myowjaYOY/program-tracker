'use client';

import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
// Member progress data type removed - using any for flexibility
import { printStyles } from './print-styles';

interface PrintMemberProgressProps {
  data: any;
}

export default function PrintMemberProgress({ data }: PrintMemberProgressProps) {
  return (
    <Box sx={printStyles.section}>
      {/* Section Title */}
      <Typography variant="h5" sx={printStyles.sectionTitle}>
        Member Progress Dashboard
      </Typography>

      {/* Profile Information */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Member Profile
        </Typography>
        <Box sx={printStyles.dataGrid}>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Member Name</Typography>
            <Typography sx={printStyles.value}>
              {data.first_name} {data.last_name}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Program</Typography>
            <Typography sx={printStyles.value}>
              {data.program_template_name || 'N/A'}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Start Date</Typography>
            <Typography sx={printStyles.value}>
              {data.program_start_date
                ? new Date(data.program_start_date).toLocaleDateString()
                : 'N/A'}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Days in Program</Typography>
            <Typography sx={printStyles.value}>
              {data.days_in_program || 0}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Curriculum Progress */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Curriculum Progress
        </Typography>
        <Box sx={printStyles.dataGrid}>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Current Week</Typography>
            <Typography sx={printStyles.value}>
              Week {data.current_week} of {data.total_weeks}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Progress</Typography>
            <Typography sx={printStyles.value}>
              {Math.round(((data.current_week || 0) / (data.total_weeks || 1)) * 100)}%
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Status</Typography>
            <Typography sx={printStyles.value}>
              {data.curriculum_status || 'In Progress'}
            </Typography>
          </Box>
        </Box>

        {/* Timeline of Completed Modules */}
        {data.completed_modules && data.completed_modules.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              Completed Modules
            </Typography>
            <Box component="table" sx={printStyles.table}>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Completed Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.completed_modules.map((module: any, idx: number) => (
                  <tr key={idx}>
                    <td>{module.module_name}</td>
                    <td>
                      {module.completed_date
                        ? new Date(module.completed_date).toLocaleDateString()
                        : 'In Progress'}
                    </td>
                    <td>{module.status}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        )}
      </Box>

      {/* Goals */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Goals in Progress
        </Typography>
        {data.goals_in_progress && data.goals_in_progress.length > 0 ? (
          <Box component="ul" sx={{ margin: 0, paddingLeft: '24px' }}>
            {data.goals_in_progress.map((goal: any, idx: number) => (
              <Box component="li" key={idx} sx={{ marginBottom: '8px' }}>
                <Typography variant="body2">
                  <strong>{goal.goal_name}</strong> - {goal.description}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Target: {goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'Not set'}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            No active goals
          </Typography>
        )}
      </Box>

      {/* Wins */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Recent Wins
        </Typography>
        {data.recent_wins && data.recent_wins.length > 0 ? (
          <Box component="ul" sx={{ margin: 0, paddingLeft: '24px' }}>
            {data.recent_wins.map((win: any, idx: number) => (
              <Box component="li" key={idx} sx={{ marginBottom: '8px' }}>
                <Typography variant="body2">{win.description}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {new Date(win.date).toLocaleDateString()}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            No wins recorded yet
          </Typography>
        )}
      </Box>

      {/* Challenges */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Current Challenges
        </Typography>
        {data.current_challenges && data.current_challenges.length > 0 ? (
          <Box component="ul" sx={{ margin: 0, paddingLeft: '24px' }}>
            {data.current_challenges.map((challenge: any, idx: number) => (
              <Box component="li" key={idx} sx={{ marginBottom: '8px' }}>
                <Typography variant="body2">{challenge.description}</Typography>
                <Typography variant="caption" color="textSecondary">
                  Status: {challenge.status}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            No challenges reported
          </Typography>
        )}
      </Box>

      {/* Health Vitals */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Health Vitals
        </Typography>
        <Box sx={printStyles.dataGrid}>
          {data.health_vitals?.weight && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Weight</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.weight} lbs
              </Typography>
            </Box>
          )}
          {data.health_vitals?.blood_pressure && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Blood Pressure</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.blood_pressure}
              </Typography>
            </Box>
          )}
          {data.health_vitals?.glucose && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Glucose</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.glucose} mg/dL
              </Typography>
            </Box>
          )}
          {data.health_vitals?.heart_rate && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Heart Rate</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.heart_rate} bpm
              </Typography>
            </Box>
          )}
        </Box>
        {!data.health_vitals && (
          <Typography variant="body2" color="textSecondary">
            No health vitals recorded
          </Typography>
        )}
      </Box>

      {/* Protocol Compliance */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Protocol Compliance
        </Typography>
        <Box sx={printStyles.dataGrid}>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Overall Compliance</Typography>
            <Typography sx={printStyles.value}>
              {data.compliance_percentage || 0}%
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Supplements Taken</Typography>
            <Typography sx={printStyles.value}>
              {data.supplements_taken || 0} / {data.supplements_prescribed || 0}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Meals Logged</Typography>
            <Typography sx={printStyles.value}>
              {data.meals_logged || 0}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Exercise Sessions</Typography>
            <Typography sx={printStyles.value}>
              {data.exercise_sessions || 0}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Data Freshness */}
      <Box sx={{ marginTop: '32px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <Typography variant="caption" color="textSecondary" fontStyle="italic">
          ℹ️ Dashboard metrics are pre-calculated and updated automatically after each survey import.
          {data.calculated_at && ` Last calculated: ${new Date(data.calculated_at).toLocaleString()}`}
        </Typography>
      </Box>
    </Box>
  );
}


