import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ScheduleAdjustmentPrompt {
  scheduledDate: string;
  redemptionDate: string;
  futureInstanceCount: number;
  itemDetails?: {
    itemId?: number;
    instanceNumber?: number;
    therapyName?: string;
    daysBetween?: number;
  };
}

interface UseScheduleStatusChangeOptions {
  programId: number;
  scheduleId: number;
  onSuccess?: () => void;
  invalidateQueries?: string[][];
}

interface UseScheduleStatusChangeReturn {
  isPromptOpen: boolean;
  promptData: ScheduleAdjustmentPrompt | null;
  isLoading: boolean;
  handleStatusChange: (newValue: boolean | null) => Promise<void>;
  handlePromptConfirm: (adjust: boolean) => Promise<void>;
  closePrompt: () => void;
}

/**
 * Hook to handle schedule status changes with adaptive adjustment prompting
 * 
 * Usage:
 * ```tsx
 * const { handleStatusChange, isPromptOpen, promptData, handlePromptConfirm, closePrompt } = 
 *   useScheduleStatusChange({
 *     programId: 119,
 *     scheduleId: 27941,
 *     invalidateQueries: [['coordinator', 'script']],
 *   });
 * 
 * // In your component:
 * <ScheduleStatusChip onStatusChange={handleStatusChange} />
 * <ScheduleAdjustmentModal 
 *   open={isPromptOpen}
 *   promptData={promptData}
 *   onConfirm={handlePromptConfirm}
 *   onClose={closePrompt}
 * />
 * ```
 */
export function useScheduleStatusChange({
  programId,
  scheduleId,
  onSuccess,
  invalidateQueries = [],
}: UseScheduleStatusChangeOptions): UseScheduleStatusChangeReturn {
  const queryClient = useQueryClient();
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptData, setPromptData] = useState<ScheduleAdjustmentPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusValue, setPendingStatusValue] = useState<boolean | null>(null);

  /**
   * Handle initial status change request
   * - Makes API call
   * - Detects 409 response and shows prompt
   * - Handles normal success/error
   */
  const handleStatusChange = async (newValue: boolean | null): Promise<void> => {
    setPendingStatusValue(newValue);
    setIsLoading(true);

    try {
      const url = `/api/member-programs/${programId}/schedule/${scheduleId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          completed_flag: newValue,
          redemption_date: new Date().toISOString().split('T')[0],
        }),
      });

      // Check for 409 Conflict (prompt required)
      if (res.status === 409) {
        const data = await res.json();
        if (data.prompt_required && data.needsPrompt) {
          setPromptData({
            scheduledDate: data.scheduledDate,
            redemptionDate: data.redemptionDate,
            futureInstanceCount: data.futureInstanceCount,
            itemDetails: data.itemDetails,
          });
          setIsPromptOpen(true);
          setIsLoading(false);
          return;
        }
      }

      // Normal error handling
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to update status');
        setIsLoading(false);
        return;
      }

      // Success - invalidate queries
      for (const queryKey of invalidateQueries) {
        await queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
      }

      onSuccess?.();
      toast.success('Status updated successfully');
      setIsLoading(false);
    } catch (error) {
      console.error('Error updating schedule status:', error);
      toast.error('Failed to update status');
      setIsLoading(false);
    }
  };

  /**
   * Handle user confirmation from modal
   * - Retries API call with confirmation flags
   * - Closes modal on success
   */
  const handlePromptConfirm = async (adjust: boolean): Promise<void> => {
    if (!promptData) return;

    setIsLoading(true);

    try {
      const url = `/api/member-programs/${programId}/schedule/${scheduleId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          completed_flag: pendingStatusValue,
          confirm_cascade: true,
          adjust_schedule: adjust,
          redemption_date: promptData.redemptionDate,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to update schedule');
        setIsLoading(false);
        return;
      }

      const result = await res.json();

      // Show success message with cascade info
      if (adjust && result.cascade) {
        const { updated_instances, updated_tasks } = result.cascade;
        toast.success(
          `Schedule adjusted! Updated ${updated_instances} future instance${updated_instances !== 1 ? 's' : ''} ` +
          `and ${updated_tasks} task${updated_tasks !== 1 ? 's' : ''}.`
        );
      } else {
        toast.success('Status updated successfully');
      }

      // Invalidate queries to refresh data
      for (const queryKey of invalidateQueries) {
        await queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
      }

      onSuccess?.();
      closePrompt();
      setIsLoading(false);
    } catch (error) {
      console.error('Error confirming schedule adjustment:', error);
      toast.error('Failed to update schedule');
      setIsLoading(false);
    }
  };

  /**
   * Close the prompt modal
   */
  const closePrompt = () => {
    setIsPromptOpen(false);
    setPromptData(null);
    setPendingStatusValue(null);
  };

  return {
    isPromptOpen,
    promptData,
    isLoading,
    handleStatusChange,
    handlePromptConfirm,
    closePrompt,
  };
}

