'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Chip,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import type { ParticipantOption } from '@/types/database.types';

interface FilterPanelProps {
  // Member filter (uses external_user_id from survey_user_mappings)
  members: ParticipantOption[] | undefined;
  membersLoading: boolean;
  selectedExternalUserId: number | null;
  onMemberChange: (externalUserId: number | null) => void;
}

export default function FilterPanel({
  members,
  membersLoading,
  selectedExternalUserId,
  onMemberChange,
}: FilterPanelProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <FilterListIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="h2">
            Filters
          </Typography>
        </Box>

        {/* Member Filter (Required) */}
        <FormControl sx={{ minWidth: 320 }} size="small" required>
          <InputLabel id="member-filter-label">Member *</InputLabel>
          <Select
            labelId="member-filter-label"
            id="member-filter"
            value={selectedExternalUserId ?? ''}
            label="Member *"
            onChange={(e) => {
              const value = e.target.value as string | number;
              onMemberChange(value === '' ? null : Number(value));
            }}
            disabled={membersLoading || !members || members.length === 0}
          >
            <MenuItem value="">
              <em>Select Member</em>
            </MenuItem>
            {members?.map((member) => (
              <MenuItem key={member.external_user_id} value={member.external_user_id}>
                {member.full_name} ({member.survey_count} MSQ surveys)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Active Member Display */}
        {selectedExternalUserId && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              Selected member:
            </Typography>
            <Chip
              label={members?.find((m) => m.external_user_id === selectedExternalUserId)?.full_name || selectedExternalUserId}
              onDelete={() => onMemberChange(null)}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

