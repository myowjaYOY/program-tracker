import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/individual-insights/[leadId]
 * 
 * Fetches individual member analytics and insights
 * - Ranking (quartile, percentile)
 * - Risk assessment
 * - Comparative analysis vs. population
 * - AI-powered recommendations
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { leadId: leadIdParam } = await context.params;
    const leadId = parseInt(leadIdParam);

    if (isNaN(leadId)) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      );
    }

    // Fetch individual insights
    const { data: insights, error: insightsError } = await supabase
      .from('member_individual_insights')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (insightsError) {
      console.error('Error fetching individual insights:', insightsError);
      return NextResponse.json(
        { error: 'Failed to fetch insights', details: insightsError.message },
        { status: 500 }
      );
    }

    if (!insights) {
      return NextResponse.json(
        { 
          error: 'No insights available', 
          message: 'Analytics data will be generated during the next survey import.' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ insights });

  } catch (error: any) {
    console.error('Error in individual insights endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


