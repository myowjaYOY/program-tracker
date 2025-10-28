/**
 * Schedule Status Utilities
 * 
 * Handles three-state status for schedule items and task schedules:
 * - null (Pending): No decision made yet
 * - true (Redeemed): Therapy/task was completed
 * - false (Missed): Therapy/task did not happen (refused, cancelled, etc.)
 */

export type ScheduleItemStatus = 'redeemed' | 'missed' | 'pending';

/**
 * Get status from completed_flag value
 * 
 * @param completed_flag - The completed_flag value from database
 * @returns Status label: 'redeemed', 'missed', or 'pending'
 * 
 * @example
 * getScheduleStatus(true)  // 'redeemed'
 * getScheduleStatus(false) // 'missed'
 * getScheduleStatus(null)  // 'pending'
 */
export function getScheduleStatus(completed_flag: boolean | null | undefined): ScheduleItemStatus {
  if (completed_flag === true) return 'redeemed';
  if (completed_flag === false) return 'missed';
  return 'pending';  // null or undefined
}

/**
 * Get next status in cycle
 * 
 * Default cycle: pending → redeemed → missed → pending
 * Skip redeemed cycle: pending → missed → pending
 * 
 * @param current - Current completed_flag value
 * @param skipRedeemed - If true, skip redeemed state (pending → missed → pending)
 * @returns Next completed_flag value in cycle
 * 
 * @example
 * getNextStatus(null)  // true (pending → redeemed)
 * getNextStatus(true)  // false (redeemed → missed)
 * getNextStatus(false) // null (missed → pending)
 * getNextStatus(null, true)  // false (pending → missed, skipping redeemed)
 */
export function getNextStatus(current: boolean | null | undefined, skipRedeemed = false): boolean | null {
  if (skipRedeemed) {
    // Skip redeemed cycle: pending ↔ missed
    if (current === null || current === undefined) return false;  // pending → missed
    if (current === false) return null;  // missed → pending
    // If somehow on redeemed, go to missed
    return false;  // redeemed → missed
  }
  
  // Default cycle: pending → redeemed → missed → pending
  if (current === null || current === undefined) return true;   // pending → redeemed
  if (current === true) return false;  // redeemed → missed
  return null;                         // missed → pending
}

/**
 * Get previous status in cycle (reverse direction)
 * 
 * Backward cycle: pending → missed → redeemed → pending
 * Used with Shift+Click modifier
 * 
 * @param current - Current completed_flag value
 * @returns Previous completed_flag value in cycle
 * 
 * @example
 * getPreviousStatus(null)  // false (pending → missed)
 * getPreviousStatus(false) // true (missed → redeemed)
 * getPreviousStatus(true)  // null (redeemed → pending)
 */
export function getPreviousStatus(current: boolean | null | undefined): boolean | null {
  if (current === null || current === undefined) return false;  // pending → missed
  if (current === false) return true;   // missed → redeemed
  return null;                          // redeemed → pending
}

/**
 * Status configuration for UI rendering
 * 
 * Contains display properties for each status state:
 * - label: Display text
 * - color: MUI Chip color
 * - chipColor: Hex color for custom styling
 * - description: Tooltip description
 */
export const STATUS_CONFIG = {
  redeemed: {
    label: 'Redeemed',
    color: 'success' as const,
    chipColor: '#10b981',
    description: 'Therapy completed successfully',
  },
  missed: {
    label: 'Missed',
    color: 'error' as const,
    chipColor: '#ef4444',
    description: 'Therapy did not happen (refused/cancelled)',
  },
  pending: {
    label: 'Pending',
    color: 'default' as const,
    chipColor: '#9ca3af',
    description: 'No decision made yet',
  },
} as const;

/**
 * Get display label for status
 * 
 * @param completed_flag - The completed_flag value from database
 * @returns Display label string
 */
export function getStatusLabel(completed_flag: boolean | null | undefined): string {
  const status = getScheduleStatus(completed_flag);
  return STATUS_CONFIG[status].label;
}

/**
 * Get color for status
 * 
 * @param completed_flag - The completed_flag value from database
 * @returns MUI Chip color
 */
export function getStatusColor(completed_flag: boolean | null | undefined): 'success' | 'error' | 'default' {
  const status = getScheduleStatus(completed_flag);
  return STATUS_CONFIG[status].color;
}

/**
 * Get tooltip text for status chip
 * 
 * @param completed_flag - Current completed_flag value
 * @param readOnly - Whether the chip is read-only
 * @returns Tooltip text
 */
export function getStatusTooltip(completed_flag: boolean | null | undefined, readOnly: boolean): string {
  const status = getScheduleStatus(completed_flag);
  
  if (readOnly) {
    return STATUS_CONFIG[status].description;
  }
  
  // Show what happens with click and shift+click
  const nextStatus = getScheduleStatus(getNextStatus(completed_flag));
  const prevStatus = getScheduleStatus(getPreviousStatus(completed_flag));
  
  return `Click: → ${STATUS_CONFIG[nextStatus].label}\nShift+Click: → ${STATUS_CONFIG[prevStatus].label}`;
}

