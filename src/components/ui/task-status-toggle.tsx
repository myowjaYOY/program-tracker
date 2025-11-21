'use client';

import { Box, Switch, Typography, Tooltip } from '@mui/material';

interface TaskStatusToggleProps {
  /**
   * Current completed_flag value from database
   * - true = Complete
   * - null/false = Pending
   */
  completed_flag: boolean | null | undefined;
  
  /**
   * Callback when user toggles status
   * @param newValue - New completed_flag value (true for complete, null for pending)
   */
  onStatusChange: (newValue: boolean | null) => void;
  
  /**
   * Whether the toggle is read-only (not clickable)
   */
  readOnly?: boolean;

  /**
   * Show label next to toggle
   */
  showLabel?: boolean;
}

/**
 * Task Status Toggle Component
 * 
 * A simple on/off toggle for marking tasks as complete or pending.
 * - OFF (left) = Pending
 * - ON (right) = Complete
 * 
 * @example
 * <TaskStatusToggle
 *   completed_flag={task.completed_flag}
 *   onStatusChange={(newValue) => handleUpdate(task.id, newValue)}
 *   readOnly={program.status !== 'Active'}
 * />
 */
export default function TaskStatusToggle({
  completed_flag,
  onStatusChange,
  readOnly = false,
  showLabel = true,
}: TaskStatusToggleProps) {
  const isComplete = completed_flag === true;
  
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    
    const newValue = event.target.checked ? true : null;
    onStatusChange(newValue);
  };
  
  const tooltipText = readOnly
    ? 'Status cannot be changed (program not active)'
    : isComplete
    ? 'Click to mark as pending'
    : 'Click to mark as complete';
  
  const label = isComplete ? 'Complete' : 'Pending';
  const labelColor = isComplete ? 'success.main' : 'text.secondary';
  
  return (
    <Tooltip title={tooltipText} arrow>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: readOnly ? 'default' : 'pointer',
        }}
      >
        <Switch
          checked={isComplete}
          onChange={handleChange}
          disabled={readOnly}
          size="small"
          sx={{
            '& .MuiSwitch-switchBase': {
              '&.Mui-checked': {
                color: 'success.main',
                '& + .MuiSwitch-track': {
                  backgroundColor: 'success.main',
                  opacity: 0.5,
                },
              },
            },
            '& .MuiSwitch-track': {
              backgroundColor: 'text.disabled',
              opacity: 0.3,
            },
          }}
        />
        {showLabel && (
          <Typography
            variant="body2"
            sx={{
              color: labelColor,
              fontWeight: isComplete ? 600 : 400,
              minWidth: 70,
            }}
          >
            {label}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

