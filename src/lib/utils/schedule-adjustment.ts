/**
 * Schedule Adjustment Utilities
 * 
 * Detects when a schedule item is being redeemed on a different date than scheduled
 * and determines if the user should be prompted to adjust future dates.
 */

import { createClient } from '@/lib/supabase/server';

export interface ScheduleAdjustmentCheck {
  needsPrompt: boolean;
  scheduledDate?: string;
  redemptionDate?: string;
  futureInstanceCount?: number;
  itemDetails?: {
    itemId: number;
    instanceNumber: number;
    therapyName?: string;
    daysBetween?: number;
  };
  reason?: string;
}

/**
 * Check if schedule adjustment prompt is needed when marking an item as redeemed
 * 
 * @param scheduleId - The member_program_item_schedule_id being redeemed
 * @param newCompletedFlag - The new completed_flag value (should be TRUE for redemption)
 * @param redemptionDate - Optional date of redemption (defaults to today)
 * @returns ScheduleAdjustmentCheck object indicating if prompt is needed
 */
export async function checkScheduleAdjustmentNeeded(
  scheduleId: number,
  currentCompletedFlag: boolean | null,
  newCompletedFlag: boolean | null,
  redemptionDate?: string
): Promise<ScheduleAdjustmentCheck> {
  // Only check when changing TO redeemed (TRUE)
  if (newCompletedFlag !== true) {
    return {
      needsPrompt: false,
      reason: 'Not marking as redeemed',
    };
  }

  // Don't prompt if already redeemed
  if (currentCompletedFlag === true) {
    return {
      needsPrompt: false,
      reason: 'Already redeemed',
    };
  }

  const supabase = await createClient();
  const actualRedemptionDate = redemptionDate || new Date().toISOString().split('T')[0];

  try {
    // Get the schedule item details
    const { data: scheduleItem, error: scheduleError } = await supabase
      .from('member_program_item_schedule')
      .select(`
        member_program_item_schedule_id,
        member_program_item_id,
        instance_number,
        scheduled_date,
        member_program_items (
          member_program_item_id,
          days_between,
          quantity,
          therapies (
            therapy_name
          )
        )
      `)
      .eq('member_program_item_schedule_id', scheduleId)
      .single();

    if (scheduleError || !scheduleItem) {
      return {
        needsPrompt: false,
        reason: 'Schedule item not found',
      };
    }

    const scheduledDate = scheduleItem.scheduled_date;
    
    // Compare dates (ignore if same date)
    if (scheduledDate === actualRedemptionDate) {
      return {
        needsPrompt: false,
        reason: 'Redemption date matches scheduled date',
      };
    }

    // Check for future incomplete instances
    const { data: futureInstances, error: futureError } = await supabase
      .from('member_program_item_schedule')
      .select('member_program_item_schedule_id, instance_number')
      .eq('member_program_item_id', scheduleItem.member_program_item_id)
      .gt('instance_number', scheduleItem.instance_number)
      .is('completed_flag', null); // Only pending instances

    if (futureError) {
      return {
        needsPrompt: false,
        reason: 'Error checking future instances',
      };
    }

    const futureCount = futureInstances?.length || 0;

    // No future instances = no need to prompt
    if (futureCount === 0) {
      return {
        needsPrompt: false,
        reason: 'No future instances to adjust',
      };
    }

    // ALL conditions met - prompt IS needed
    const itemDetails = scheduleItem.member_program_items as any;
    
    const result: ScheduleAdjustmentCheck = {
      needsPrompt: true,
      futureInstanceCount: futureCount,
      itemDetails: {
        itemId: scheduleItem.member_program_item_id,
        instanceNumber: scheduleItem.instance_number,
        therapyName: itemDetails?.therapies?.therapy_name,
        daysBetween: itemDetails?.days_between,
      },
    };

    // Only add optional fields if they have values
    if (scheduledDate) {
      result.scheduledDate = scheduledDate;
    }
    if (actualRedemptionDate) {
      result.redemptionDate = actualRedemptionDate;
    }

    return result;
  } catch (error) {
    console.error('Error in checkScheduleAdjustmentNeeded:', error);
    return {
      needsPrompt: false,
      reason: 'Unexpected error',
    };
  }
}

/**
 * Calculate the difference in days between two dates
 */
export function calculateDateDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Format date difference for user display
 */
export function formatDateDifference(scheduledDate: string, redemptionDate: string): string {
  const diff = calculateDateDifference(scheduledDate, redemptionDate);
  const scheduled = new Date(scheduledDate);
  const redemption = new Date(redemptionDate);
  
  if (redemption > scheduled) {
    return `${diff} day${diff !== 1 ? 's' : ''} late`;
  } else {
    return `${diff} day${diff !== 1 ? 's' : ''} early`;
  }
}

