import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkScheduleAdjustmentNeeded } from '@/lib/utils/schedule-adjustment';

interface UpdateScheduleBody {
  completed_flag?: boolean | null;
  confirm_cascade?: boolean;
  adjust_schedule?: boolean;
  redemption_date?: string;
  // For direct date changes (calendar icon feature)
  scheduled_date?: string;
  adjust_future?: boolean;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; scheduleId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, scheduleId } = await context.params;
  let body: UpdateScheduleBody = {};
  try {
    body = await req.json();
  } catch {}

  try {
    const scheduleIdNum = parseInt(scheduleId);

    // Get current state before updating (including instance_number for cascade)
    const { data: currentItem, error: fetchError } = await supabase
      .from('member_program_item_schedule')
      .select('completed_flag, scheduled_date, member_program_item_id, instance_number')
      .eq('member_program_item_schedule_id', scheduleIdNum)
      .single();

    if (fetchError || !currentItem) {
      return NextResponse.json(
        { error: 'Schedule item not found' },
        { status: 404 }
      );
    }

    // ========================================
    // DIRECT DATE CHANGE (Calendar Icon Feature)
    // ========================================
    // If scheduled_date is provided without completed_flag, this is a direct date change
    if (body.scheduled_date && body.completed_flag === undefined) {
      const programId = parseInt(id);
      const newDate = body.scheduled_date;

      try {
        // Step 1: Update this instance's scheduled_date
        const { data: updatedItem, error: updateError } = await supabase
          .from('member_program_item_schedule')
          .update({ scheduled_date: newDate })
          .eq('member_program_item_schedule_id', scheduleIdNum)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating scheduled_date:', updateError);
          return NextResponse.json(
            { error: 'Failed to update scheduled date' },
            { status: 500 }
          );
        }

        // Step 2: Update this instance's associated tasks
        // Get tasks with their delays and update due_date = new_date + task_delay
        const { data: taskSchedules } = await supabase
          .from('member_program_items_task_schedule')
          .select(`
            member_program_item_task_schedule_id,
            member_program_item_tasks!inner (
              task_delay
            )
          `)
          .eq('member_program_item_schedule_id', scheduleIdNum);

        if (taskSchedules && taskSchedules.length > 0) {
          for (const ts of taskSchedules) {
            const taskDelay = (ts.member_program_item_tasks as any)?.task_delay || 0;
            const newDueDate = new Date(newDate);
            newDueDate.setDate(newDueDate.getDate() + taskDelay);
            // Skip weekends
            while (newDueDate.getDay() === 0 || newDueDate.getDay() === 6) {
              newDueDate.setDate(newDueDate.getDate() + 1);
            }
            await supabase
              .from('member_program_items_task_schedule')
              .update({ due_date: newDueDate.toISOString().split('T')[0] })
              .eq('member_program_item_task_schedule_id', ts.member_program_item_task_schedule_id);
          }
        }

        // Step 3: If adjust_future is true, cascade to future instances
        if (body.adjust_future) {
          const { data: cascadeResult, error: cascadeError } = await supabase
            .rpc('adjust_future_schedule_instances', {
              p_member_program_item_id: currentItem.member_program_item_id,
              p_current_instance_number: currentItem.instance_number,
              p_new_scheduled_date: newDate,
              p_program_id: programId,
            });

          if (cascadeError) {
            console.error('Cascade function error:', cascadeError);
            return NextResponse.json(
              {
                error: 'Failed to cascade schedule changes',
                details: cascadeError.message,
                data: updatedItem,
              },
              { status: 500 }
            );
          }

          if (cascadeResult && !cascadeResult.ok) {
            console.error('Cascade function returned error:', cascadeResult.error);
            return NextResponse.json(
              {
                error: 'Cascade function failed',
                details: cascadeResult.error,
                data: updatedItem,
              },
              { status: 500 }
            );
          }

          return NextResponse.json({
            data: updatedItem,
            cascade: cascadeResult,
            message: `Date changed. Updated ${cascadeResult?.updated_instances || 0} future instance(s) and ${cascadeResult?.updated_tasks || 0} task(s).`,
          });
        }

        // No cascade - just return the updated item
        return NextResponse.json({
          data: updatedItem,
          message: 'Scheduled date updated successfully',
        });
      } catch (dateChangeErr: any) {
        console.error('Unexpected date change error:', dateChangeErr);
        return NextResponse.json(
          { error: dateChangeErr?.message || 'Failed to change date' },
          { status: 500 }
        );
      }
    }

    // ========================================
    // COMPLETED_FLAG CHANGE (Redemption Flow)
    // ========================================
    // Check if adjustment prompt is needed
    if (body.completed_flag === true && !body.confirm_cascade) {
      const adjustmentCheck = await checkScheduleAdjustmentNeeded(
        scheduleIdNum,
        currentItem.completed_flag,
        body.completed_flag,
        body.redemption_date
      );

      if (adjustmentCheck.needsPrompt) {
        // Return 409 Conflict with prompt data
        return NextResponse.json(
          {
            prompt_required: true,
            ...adjustmentCheck,
          },
          { status: 409 }
        );
      }
    }

    // If we get here, either:
    // 1. No prompt needed, OR
    // 2. User confirmed (confirm_cascade = true)

    // Update the current schedule item
    const { data, error } = await supabase
      .from('member_program_item_schedule')
      .update({ 
        completed_flag: body.completed_flag !== undefined ? body.completed_flag : null 
      })
      .eq('member_program_item_schedule_id', scheduleIdNum)
      .select()
      .single();
      
    if (error) {
      console.error('Supabase error updating schedule:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update schedule' },
        { status: 500 }
      );
    }

    // If user confirmed AND wants to adjust schedule
    if (body.confirm_cascade && body.adjust_schedule) {
      const redemptionDate = body.redemption_date || new Date().toISOString().split('T')[0];
      const programId = parseInt(id);

      try {
        // Step 1: Update current instance's scheduled_date to redemption date
        const { error: updateDateError } = await supabase
          .from('member_program_item_schedule')
          .update({ scheduled_date: redemptionDate })
          .eq('member_program_item_schedule_id', scheduleIdNum);

        if (updateDateError) {
          console.error('Error updating scheduled_date:', updateDateError);
          // Don't fail entirely, cascade might still work
        }

        // Step 2: Call cascade function to update future instances
        const { data: cascadeResult, error: cascadeError } = await supabase
          .rpc('adjust_future_schedule_instances', {
            p_member_program_item_id: currentItem.member_program_item_id,
            p_current_instance_number: currentItem.instance_number,
            p_new_scheduled_date: redemptionDate,
            p_program_id: programId,
          });

        if (cascadeError) {
          console.error('Cascade function error:', cascadeError);
          return NextResponse.json(
            {
              error: 'Failed to cascade schedule changes',
              details: cascadeError.message,
              data, // Return the updated item even if cascade failed
            },
            { status: 500 }
          );
        }

        // Check if cascade function returned an error
        if (cascadeResult && !cascadeResult.ok) {
          console.error('Cascade function returned error:', cascadeResult.error);
          return NextResponse.json(
            {
              error: 'Cascade function failed',
              details: cascadeResult.error,
              data,
            },
            { status: 500 }
          );
        }

        // Success - return updated item + cascade stats
        return NextResponse.json({
          data,
          cascade: cascadeResult,
          message: `Schedule adjusted. Updated ${cascadeResult?.updated_instances || 0} future instances and ${cascadeResult?.updated_tasks || 0} tasks.`,
        });
      } catch (cascadeErr: any) {
        console.error('Unexpected cascade error:', cascadeErr);
        return NextResponse.json(
          {
            error: 'Unexpected error during cascade',
            details: cascadeErr?.message,
            data,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
