'use client';

import { Chip, Tooltip } from '@mui/material';
import {
  CheckCircle as RedeemedIcon,
  Cancel as MissedIcon,
  RadioButtonUnchecked as PendingIcon,
} from '@mui/icons-material';
import {
  getScheduleStatus,
  getNextStatus,
  getPreviousStatus,
  getStatusTooltip,
  STATUS_CONFIG,
  type ScheduleItemStatus,
} from '@/lib/utils/schedule-status';

interface ScheduleStatusChipProps {
  /**
   * Current completed_flag value from database
   * - true = Redeemed (completed)
   * - false = Missed (did not happen)
   * - null = Pending (no decision made)
   */
  completed_flag: boolean | null | undefined;
  
  /**
   * Callback when user clicks chip to change status
   * @param newValue - New completed_flag value to set
   */
  onStatusChange: (newValue: boolean | null) => void;
  
  /**
   * Whether the chip is read-only (not clickable)
   * Typically true when program is not Active
   */
  readOnly?: boolean;
}

/**
 * Schedule Status Chip Component
 * 
 * Displays and allows cycling through three status states:
 * - Pending (gray, ⭕) - No decision made yet
 * - Redeemed (green, ✅) - Therapy completed
 * - Missed (red, ❌) - Therapy did not happen
 * 
 * Click behavior (if not read-only):
 * - Click: Forward cycle (Pending → Redeemed → Missed → Pending)
 * - Shift+Click: Backward cycle (Pending → Missed → Redeemed → Pending)
 * 
 * @example
 * <ScheduleStatusChip
 *   completed_flag={item.completed_flag}
 *   onStatusChange={(newValue) => handleUpdate(item.id, newValue)}
 *   readOnly={program.status !== 'Active'}
 * />
 */
export default function ScheduleStatusChip({
  completed_flag,
  onStatusChange,
  readOnly = false,
}: ScheduleStatusChipProps) {
  const status: ScheduleItemStatus = getScheduleStatus(completed_flag);
  const config = STATUS_CONFIG[status];
  
  const handleClick = (event: React.MouseEvent) => {
    if (readOnly) return;
    
    // Shift+Click: Backward cycle
    if (event.shiftKey) {
      const prevValue = getPreviousStatus(completed_flag);
      onStatusChange(prevValue);
    } else {
      // Normal click: Forward cycle
      const nextValue = getNextStatus(completed_flag);
      onStatusChange(nextValue);
    }
  };
  
  const tooltipText = getStatusTooltip(completed_flag, readOnly);
  
  // Select icon based on status
  const IconComponent = 
    status === 'redeemed' ? RedeemedIcon :
    status === 'missed' ? MissedIcon :
    PendingIcon;
  
  return (
    <Tooltip title={tooltipText} arrow>
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        icon={<IconComponent sx={{ fontSize: 16 }} />}
        onClick={handleClick}
        sx={{ 
          cursor: readOnly ? 'default' : 'pointer',
          '&:hover': readOnly ? {} : {
            opacity: 0.8,
            transform: 'scale(1.02)',
          },
          transition: 'all 0.2s ease-in-out',
        }}
      />
    </Tooltip>
  );
}

