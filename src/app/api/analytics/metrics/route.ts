/**
 * Analytics Metrics API Endpoint
 * 
 * GET /api/analytics/metrics
 * 
 * Returns the latest pre-calculated analytics metrics from cache.
 * If no cache exists, returns 404 with instruction to refresh.
 * 
 * Response format:
 * {
 *   data: {
 *     calculated_at: "2025-11-07T...",
 *     member_count: 100,
 *     active_member_count: 75,
 *     // ... all analytics metrics
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

    console.log('[Analytics Metrics] Fetching latest cache...');

    // Get the latest analytics cache entry
    const { data: cache, error: cacheError } = await supabase
      .from('member_analytics_cache')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheError) {
      console.error('[Analytics Metrics] Error fetching cache:', cacheError);
      return NextResponse.json(
        { error: 'Failed to fetch analytics metrics', details: cacheError.message },
        { status: 500 }
      );
    }

    if (!cache) {
      console.warn('[Analytics Metrics] No cache found');
      return NextResponse.json(
        { 
          error: 'No analytics data available',
          message: 'Analytics cache is empty. Please trigger a refresh first by calling POST /api/analytics/refresh'
        },
        { status: 404 }
      );
    }

    console.log(
      `[Analytics Metrics] Cache found - ID: ${cache.cache_id}, Calculated: ${cache.calculated_at}, Members: ${cache.member_count}`
    );

    // Return the cache data
    return NextResponse.json({
      data: cache
    });

  } catch (error: any) {
    console.error('[Analytics Metrics] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}








