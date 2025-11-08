/**
 * Analytics Refresh API Endpoint
 * 
 * POST /api/analytics/refresh
 * 
 * Triggers the calculation of analytics metrics by calling the
 * calculate_analytics_metrics() database function.
 * 
 * This is a potentially long-running operation (5-10 seconds for 100 members).
 * 
 * Response format:
 * {
 *   data: {
 *     success: true,
 *     message: "Analytics calculated successfully. Cache ID: 123, Duration: 5234ms",
 *     calculation_time_ms: 5234,
 *     members_analyzed: 100
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for calculation

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Analytics Refresh] Starting analytics calculation...');
    const startTime = Date.now();

    // Call the database function to calculate analytics
    const { data, error } = await supabase.rpc('calculate_analytics_metrics');

    if (error) {
      console.error('[Analytics Refresh] Error calculating analytics:', error);
      return NextResponse.json(
        { 
          error: 'Failed to calculate analytics metrics', 
          details: error.message 
        },
        { status: 500 }
      );
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log('[Analytics Refresh] Calculation complete:', {
      success: data?.[0]?.success,
      message: data?.[0]?.message,
      calculation_time_ms: data?.[0]?.calculation_time_ms,
      members_analyzed: data?.[0]?.members_analyzed,
      total_api_time_ms: totalTime
    });

    // Return the result from the database function
    return NextResponse.json({
      data: {
        success: data?.[0]?.success ?? true,
        message: data?.[0]?.message ?? 'Analytics calculated successfully',
        calculation_time_ms: data?.[0]?.calculation_time_ms,
        members_analyzed: data?.[0]?.members_analyzed,
        total_api_time_ms: totalTime
      }
    });

  } catch (error: any) {
    console.error('[Analytics Refresh] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Optional: Allow GET requests to check refresh status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the most recent cache info
    const { data: cache, error: cacheError } = await supabase
      .from('member_analytics_cache')
      .select('cache_id, calculated_at, calculation_duration_ms, member_count')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheError) {
      return NextResponse.json(
        { error: 'Failed to fetch cache info', details: cacheError.message },
        { status: 500 }
      );
    }

    if (!cache) {
      return NextResponse.json({
        data: {
          has_cache: false,
          message: 'No analytics cache exists yet. Trigger a refresh with POST /api/analytics/refresh'
        }
      });
    }

    // Calculate age of cache
    const cacheAge = Date.now() - new Date(cache.calculated_at).getTime();
    const cacheAgeHours = Math.floor(cacheAge / (1000 * 60 * 60));
    const cacheAgeMinutes = Math.floor((cacheAge % (1000 * 60 * 60)) / (1000 * 60));

    return NextResponse.json({
      data: {
        has_cache: true,
        cache_id: cache.cache_id,
        calculated_at: cache.calculated_at,
        cache_age: `${cacheAgeHours}h ${cacheAgeMinutes}m`,
        calculation_duration_ms: cache.calculation_duration_ms,
        member_count: cache.member_count
      }
    });

  } catch (error: any) {
    console.error('[Analytics Refresh GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}






