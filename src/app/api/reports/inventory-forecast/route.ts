import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProgramStatusService } from '@/lib/services/program-status-service';

// GET /api/reports/inventory-forecast?range=this_month|next_month|custom&start=&end=&therapyTypes=1,2,3
// Returns aggregated inventory forecast data grouped by therapy type and therapy name
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  
  // Authentication check
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get('range') || 'this_month').toLowerCase();
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const therapyTypesParam = searchParams.get('therapyTypes');
  const therapyTypeIds = therapyTypesParam 
    ? therapyTypesParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    : null;

  try {
    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: string;
    let endDate: string;
    
    if (range === 'custom' && start && end) {
      startDate = start;
      endDate = end;
    } else if (range === 'next_month') {
      // Next month: first day to last day of next month
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      startDate = nextMonth.toISOString().slice(0, 10);
      endDate = lastDayNextMonth.toISOString().slice(0, 10);
    } else {
      // Default: this_month - first day to last day of current month
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = firstDay.toISOString().slice(0, 10);
      endDate = lastDay.toISOString().slice(0, 10);
    }

    // Get valid program IDs (Active + Paused only) using centralized service
    const activeProgramIds = await ProgramStatusService.getValidProgramIds(supabase, {
      includeStatuses: ['paused']
    });

    if (activeProgramIds.length === 0) {
      return NextResponse.json({ 
        data: [], 
        metrics: {
          total_cost_owed: 0,
          total_products_owed: 0,
          cost_owed_this_month: 0,
          cost_owed_next_month: 0,
        }
      });
    }

    // Get "no show" bucket IDs to exclude
    const { data: buckets, error: bucketErr } = await supabase
      .from('buckets')
      .select('bucket_id, bucket_name');
    
    if (bucketErr) {
      console.error('Error fetching buckets:', bucketErr);
    }

    const noShowBucketIds = (buckets || [])
      .filter((b: any) => (b.bucket_name || '').toLowerCase() === 'no show')
      .map((b: any) => b.bucket_id);

    // Get member_program_items for active programs
    let itemsQuery = supabase
      .from('member_program_items')
      .select('member_program_item_id, member_program_id, therapy_id, item_cost')
      .in('member_program_id', activeProgramIds);

    const { data: items, error: itemsErr } = await itemsQuery;
    
    if (itemsErr) {
      console.error('Error fetching items:', itemsErr);
      return NextResponse.json(
        { error: 'Failed to load items' },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        data: [], 
        metrics: {
          total_cost_owed: 0,
          total_products_owed: 0,
          cost_owed_this_month: 0,
          cost_owed_next_month: 0,
        }
      });
    }

    const itemIds = items.map((i: any) => i.member_program_item_id);

    // Get therapies info (with bucket filtering)
    const therapyIds = Array.from(new Set(items.map((i: any) => i.therapy_id).filter(Boolean)));
    
    let therapiesQuery = supabase
      .from('therapies')
      .select('therapy_id, therapy_name, therapy_type_id, bucket_id, cost')
      .in('therapy_id', therapyIds);
    
    // Exclude "no show" buckets
    if (noShowBucketIds.length > 0) {
      therapiesQuery = therapiesQuery.not('bucket_id', 'in', `(${noShowBucketIds.join(',')})`);
    }

    // Filter by therapy types if specified
    if (therapyTypeIds && therapyTypeIds.length > 0) {
      therapiesQuery = therapiesQuery.in('therapy_type_id', therapyTypeIds);
    }

    const { data: therapies, error: therapiesErr } = await therapiesQuery;
    
    if (therapiesErr) {
      console.error('Error fetching therapies:', therapiesErr);
      return NextResponse.json(
        { error: 'Failed to load therapies' },
        { status: 500 }
      );
    }

    if (!therapies || therapies.length === 0) {
      return NextResponse.json({ 
        data: [], 
        metrics: {
          total_cost_owed: 0,
          total_products_owed: 0,
          cost_owed_this_month: 0,
          cost_owed_next_month: 0,
        }
      });
    }

    // Create therapy lookup map
    const therapyMap = new Map(therapies.map((t: any) => [t.therapy_id, t]));
    
    // Filter items to only those with valid therapies (after bucket filtering)
    const validTherapyIds = new Set(therapies.map((t: any) => t.therapy_id));
    const validItems = items.filter((i: any) => validTherapyIds.has(i.therapy_id));
    const validItemIds = validItems.map((i: any) => i.member_program_item_id);

    if (validItemIds.length === 0) {
      return NextResponse.json({ 
        data: [], 
        metrics: {
          total_cost_owed: 0,
          total_products_owed: 0,
          cost_owed_this_month: 0,
          cost_owed_next_month: 0,
        }
      });
    }

    // Get therapy types
    const therapyTypeIds_all = Array.from(new Set(therapies.map((t: any) => t.therapy_type_id).filter(Boolean)));
    const { data: therapyTypes, error: typesErr } = await supabase
      .from('therapytype')
      .select('therapy_type_id, therapy_type_name')
      .in('therapy_type_id', therapyTypeIds_all);
    
    if (typesErr) {
      console.error('Error fetching therapy types:', typesErr);
    }

    const therapyTypeMap = new Map((therapyTypes || []).map((tt: any) => [tt.therapy_type_id, tt.therapy_type_name]));

    // Get schedule data for the date range
    let scheduleQuery = supabase
      .from('member_program_item_schedule')
      .select('member_program_item_id, scheduled_date, completed_flag')
      .in('member_program_item_id', validItemIds)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate);

    const { data: scheduleRows, error: schedErr } = await scheduleQuery;
    
    if (schedErr) {
      console.error('Error fetching schedule:', schedErr);
      return NextResponse.json(
        { error: 'Failed to fetch schedule' },
        { status: 500 }
      );
    }

    // Create item lookup map
    const itemMap = new Map(validItems.map((i: any) => [i.member_program_item_id, i]));

    // Get inventory items for quantity on hand (only active items)
    const { data: inventoryItems, error: invErr } = await supabase
      .from('inventory_items')
      .select('therapy_id, quantity_on_hand')
      .in('therapy_id', Array.from(therapyMap.keys()))
      .eq('active_flag', true);
    
    if (invErr) {
      console.error('Error fetching inventory items:', invErr);
    }

    const inventoryMap = new Map((inventoryItems || []).map((inv: any) => [inv.therapy_id, inv.quantity_on_hand]));

    // Aggregate data by therapy_type_name and therapy_name
    const aggregationMap = new Map<string, {
      therapy_type_name: string;
      therapy_name: string;
      therapy_id: number;
      dispensed_count: number;
      owed_count: number;
      total_count: number;
      member_cost: number;
      current_cost: number;
      quantity_on_hand: number;
      in_inventory: boolean;
    }>();

    (scheduleRows || []).forEach((row: any) => {
      const item = itemMap.get(row.member_program_item_id);
      if (!item) return;

      const therapy = therapyMap.get(item.therapy_id);
      if (!therapy) return;

      const therapyTypeName = therapyTypeMap.get(therapy.therapy_type_id) || 'Unknown';
      const therapyName = therapy.therapy_name || 'Unknown';
      const key = `${therapyTypeName}|${therapyName}`;

      if (!aggregationMap.has(key)) {
        aggregationMap.set(key, {
          therapy_type_name: therapyTypeName,
          therapy_name: therapyName,
          therapy_id: therapy.therapy_id,
          dispensed_count: 0,
          owed_count: 0,
          total_count: 0,
          member_cost: item.item_cost || 0,
          current_cost: therapy.cost || 0,
          quantity_on_hand: inventoryMap.get(therapy.therapy_id) || 0,
          in_inventory: inventoryMap.has(therapy.therapy_id),
        });
      }

      const agg = aggregationMap.get(key)!;
      agg.total_count += 1;
      
      if (row.completed_flag) {
        agg.dispensed_count += 1;
      } else {
        agg.owed_count += 1;
      }
    });

    // Convert map to array and sort by therapy type, then therapy name
    const aggregatedData = Array.from(aggregationMap.values()).sort((a, b) => {
      const typeCompare = a.therapy_type_name.localeCompare(b.therapy_type_name);
      if (typeCompare !== 0) return typeCompare;
      return a.therapy_name.localeCompare(b.therapy_name);
    });

    // Calculate metrics
    // For metrics, we need ALL schedule data (not just the filtered date range)
    // Get all schedule for valid items
    const { data: allScheduleRows } = await supabase
      .from('member_program_item_schedule')
      .select('member_program_item_id, scheduled_date, completed_flag')
      .in('member_program_item_id', validItemIds);

    // Calculate date ranges for metrics
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().slice(0, 10);

    let total_cost_owed = 0;
    let total_products_owed = 0;
    let cost_owed_this_month = 0;
    let cost_owed_next_month = 0;

    (allScheduleRows || []).forEach((row: any) => {
      const item = itemMap.get(row.member_program_item_id);
      if (!item || row.completed_flag) return; // Only count owed (not dispensed)

      const cost = item.item_cost || 0;
      total_cost_owed += cost;
      total_products_owed += 1;

      // Check if in this month
      if (row.scheduled_date >= thisMonthStart && row.scheduled_date <= thisMonthEnd) {
        cost_owed_this_month += cost;
      }

      // Check if in next month
      if (row.scheduled_date >= nextMonthStart && row.scheduled_date <= nextMonthEnd) {
        cost_owed_next_month += cost;
      }
    });

    return NextResponse.json({ 
      data: aggregatedData,
      metrics: {
        total_cost_owed,
        total_products_owed,
        cost_owed_this_month,
        cost_owed_next_month,
      }
    });

  } catch (e: any) {
    console.error('Unexpected error in GET /api/reports/inventory-forecast:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

