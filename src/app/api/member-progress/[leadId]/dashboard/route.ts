import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/member-progress/:leadId/dashboard
 * 
 * Returns pre-calculated member progress dashboard metrics from member_progress_summary table.
 * Dashboard data is calculated and updated by the survey import edge function on each import.
 * 
 * @param leadId - lead_id from leads table
 * @returns Dashboard metrics including health vitals, compliance, alerts, timeline, goals
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId: leadIdParam } = await context.params;
    const leadId = parseInt(leadIdParam);
    
    if (isNaN(leadId)) {
      console.error('Invalid lead ID:', leadIdParam);
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      );
    }

    console.log(`Fetching dashboard for lead ${leadId}...`);

    // Query pre-calculated dashboard data from member_progress_summary
    const { data, error } = await supabase
      .from('member_progress_summary')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dashboard data' },
        { status: 500 }
      );
    }

    if (!data) {
      // No dashboard data exists yet for this member
      // This can happen if:
      // 1. Member hasn't completed any surveys yet
      // 2. Survey import hasn't run since edge function was deployed
      // 3. Dashboard calculation failed for this member
      return NextResponse.json(
        { 
          error: 'Dashboard data not available',
          message: 'No dashboard data found for this member. Data will be available after the next survey import.'
        },
        { status: 404 }
      );
    }

    // Parse JSON fields for client consumption
    // Note: JSONB fields from Postgres come as objects/arrays already (not strings)
    const dashboardData = {
      ...data,
      // Ensure arrays are proper arrays (handle both string and object cases for safety)
      energy_sparkline: typeof data.energy_sparkline === 'string' 
        ? JSON.parse(data.energy_sparkline) 
        : (data.energy_sparkline || []),
      mood_sparkline: typeof data.mood_sparkline === 'string'
        ? JSON.parse(data.mood_sparkline)
        : (data.mood_sparkline || []),
      motivation_sparkline: typeof data.motivation_sparkline === 'string'
        ? JSON.parse(data.motivation_sparkline)
        : (data.motivation_sparkline || []),
      wellbeing_sparkline: typeof data.wellbeing_sparkline === 'string'
        ? JSON.parse(data.wellbeing_sparkline)
        : (data.wellbeing_sparkline || []),
      sleep_sparkline: typeof data.sleep_sparkline === 'string'
        ? JSON.parse(data.sleep_sparkline)
        : (data.sleep_sparkline || []),
      latest_wins: typeof data.latest_wins === 'string'
        ? JSON.parse(data.latest_wins)
        : (data.latest_wins || []),
      latest_concerns: typeof data.latest_concerns === 'string'
        ? JSON.parse(data.latest_concerns)
        : (data.latest_concerns || []),
      module_sequence: typeof data.module_sequence === 'string'
        ? JSON.parse(data.module_sequence)
        : (data.module_sequence || []),
      completed_milestones: typeof data.completed_milestones === 'string'
        ? JSON.parse(data.completed_milestones)
        : (data.completed_milestones || []),
      overdue_milestones: typeof data.overdue_milestones === 'string'
        ? JSON.parse(data.overdue_milestones)
        : (data.overdue_milestones || []),
      goals: typeof data.goals === 'string'
        ? JSON.parse(data.goals)
        : (data.goals || []),
    };

    console.log(`Successfully fetched dashboard for lead ${leadId}`);

    return NextResponse.json(
      { data: dashboardData },
      { 
        status: 200,
        headers: {
          // Cache for 5 minutes since data is updated periodically, not real-time
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      }
    );

  } catch (error) {
    console.error('Unexpected error in dashboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

