import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/member-programs/[id]/schedule/[scheduleId]/future-count
 * 
 * Returns the count of future pending instances for a schedule item,
 * plus item details needed for the date change modal.
 * 
 * Response:
 * {
 *   futureInstanceCount: number,
 *   itemDetails: {
 *     therapyName: string,
 *     instanceNumber: number,
 *     daysBetween: number
 *   }
 * }
 */
export async function GET(
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

  const { scheduleId } = await context.params;

  try {
    const scheduleIdNum = parseInt(scheduleId);

    // Get the current schedule item details
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
      .eq('member_program_item_schedule_id', scheduleIdNum)
      .single();

    if (scheduleError || !scheduleItem) {
      return NextResponse.json(
        { error: 'Schedule item not found' },
        { status: 404 }
      );
    }

    // Count future pending instances
    const { count, error: countError } = await supabase
      .from('member_program_item_schedule')
      .select('member_program_item_schedule_id', { count: 'exact', head: true })
      .eq('member_program_item_id', scheduleItem.member_program_item_id)
      .gt('instance_number', scheduleItem.instance_number)
      .is('completed_flag', null); // Only pending instances

    if (countError) {
      console.error('Error counting future instances:', countError);
      return NextResponse.json(
        { error: 'Failed to count future instances' },
        { status: 500 }
      );
    }

    // Extract item details
    const itemData = scheduleItem.member_program_items as any;
    
    return NextResponse.json({
      futureInstanceCount: count || 0,
      itemDetails: {
        therapyName: itemData?.therapies?.therapy_name || null,
        instanceNumber: scheduleItem.instance_number,
        daysBetween: itemData?.days_between || 0,
      },
    });
  } catch (e: any) {
    console.error('Error in future-count endpoint:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

