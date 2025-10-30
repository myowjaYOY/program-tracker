import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/reanalyze-dashboards
 * 
 * Triggers re-analysis of member progress dashboards for all members.
 * This endpoint calls the analyze-member-progress edge function with mode='all'.
 * 
 * Use cases:
 * - After refining wins/challenges classification logic
 * - After updating any dashboard calculation logic
 * - To refresh dashboard data without waiting for new survey imports
 * 
 * @returns {Object} Analysis results with success status, member counts, duration, errors
 */
export async function POST(request: Request) {
  try {
    // Create Supabase client (will check authentication)
    const supabase = await createClient();

    // Verify user is authenticated and is admin
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin (optional - add if you have role checking)
    // const { data: profile } = await supabase
    //   .from('user_profiles')
    //   .select('is_admin')
    //   .eq('user_id', session.user.id)
    //   .single();
    // 
    // if (!profile?.is_admin) {
    //   return NextResponse.json(
    //     { error: 'Admin access required' },
    //     { status: 403 }
    //   );
    // }

    // Parse request body for test_mode parameter
    const body = await request.json().catch(() => ({}));
    const testMode = body.test_mode === true;

    console.log(`Triggering dashboard re-analysis for all members (test_mode: ${testMode})...`);

    // Get Supabase URL and service role key from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Call the analysis edge function with mode='all'
    const analysisUrl = `${supabaseUrl}/functions/v1/analyze-member-progress`;
    
    console.log(`Calling analysis function: ${analysisUrl}`);
    
    const response = await fetch(analysisUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: 'all',
        test_mode: testMode
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Analysis function returned ${response.status}: ${errorText}`);
      return NextResponse.json(
        { 
          error: 'Analysis function failed', 
          details: errorText,
          status: response.status
        },
        { status: 500 }
      );
    }

    const result = await response.json();
    
    console.log(`Dashboard re-analysis completed:`, result);

    return NextResponse.json({
      success: true,
      message: 'Dashboard re-analysis completed successfully',
      ...result
    });

  } catch (error: any) {
    console.error('Error triggering dashboard re-analysis:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/reanalyze-dashboards
 * 
 * Returns information about the dashboard analysis system.
 */
export async function GET() {
  try {
    // Create Supabase client
    const supabase = await createClient();

    // Get count of members with dashboards
    const { count: dashboardCount } = await supabase
      .from('member_progress_summary')
      .select('*', { count: 'exact', head: true });

    // Get count of total members with survey mappings
    const { count: memberCount } = await supabase
      .from('survey_user_mappings')
      .select('*', { count: 'exact', head: true });

    // Get last analysis timestamp
    const { data: lastAnalysis } = await supabase
      .from('member_progress_summary')
      .select('calculated_at')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle zero results

    return NextResponse.json({
      dashboard_count: dashboardCount || 0,
      member_count: memberCount || 0,
      last_analysis: lastAnalysis?.calculated_at || null,
      status: 'operational'
    });

  } catch (error: any) {
    console.error('Error fetching dashboard info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard info' },
      { status: 500 }
    );
  }
}

