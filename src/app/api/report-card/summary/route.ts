import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ReportCardSummary } from '@/types/database.types';

/**
 * GET /api/report-card/summary
 * 
 * Returns summary metrics for the dashboard cards:
 * - Total members with MSQ survey data (from survey_user_mappings)
 * - Average MSQ improvement
 * - Survey completion rate
 * 
 * Query params:
 * - date_range (optional): Filter by date range (e.g., "30d", "90d", "all")
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('date_range') || '90d';

    // Calculate date threshold
    const daysAgo = dateRange === 'all' ? 365 * 10 : parseInt(dateRange.replace('d', ''));
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    // Query 1: Total members with MSQ survey data (from survey_user_mappings)
    // Join survey_user_mappings with survey_response_sessions to count distinct members
    const { data: memberSessions } = await supabase
      .from('survey_response_sessions')
      .select('external_user_id')
      .eq('form_id', 3) // MSQ-95 only
      .gte('completed_on', dateThreshold.toISOString())
      .not('external_user_id', 'is', null);

    // Count distinct external_user_ids
    const uniqueMembers = new Set(memberSessions?.map(s => s.external_user_id) || []);
    const totalMembers = uniqueMembers.size;

    // Query 2: Members with baseline MSQ (same as total members with MSQ data)
    const membersWithBaseline = totalMembers;

    // Query 3: MSQ scores for improvement calculation
    const { data: msqSessions } = await supabase
      .from('survey_response_sessions')
      .select('external_user_id, completed_on, session_id')
      .eq('form_id', 3) // MSQ
      .gte('completed_on', dateThreshold.toISOString())
      .not('external_user_id', 'is', null)
      .order('completed_on', { ascending: true });

    // Calculate MSQ improvement (baseline vs latest per member)
    const msqByMember = new Map<number, { first: number; latest: number }>();
    
    if (msqSessions && msqSessions.length > 0) {
      // Get responses for these sessions
      const sessionIds = msqSessions.map(s => s.session_id);
      const { data: msqResponses } = await supabase
        .from('survey_responses')
        .select('session_id, answer_text')
        .in('session_id', sessionIds);

      // Group by session and calculate scores
      const sessionScores = new Map<number, number>();
      if (msqResponses) {
        for (const response of msqResponses) {
          const score = getMsqAnswerScore(response.answer_text);
          sessionScores.set(
            response.session_id,
            (sessionScores.get(response.session_id) || 0) + score
          );
        }
      }

      // Track first and latest scores per member
      for (const session of msqSessions) {
        const score = sessionScores.get(session.session_id) || 0;
        const memberId = session.external_user_id;
        if (!memberId) continue;
        
        const existing = msqByMember.get(memberId);
        if (!existing) {
          msqByMember.set(memberId, { first: score, latest: score });
        } else {
          existing.latest = score;
        }
      }
    }

    // Calculate average MSQ improvement
    let totalMsqImprovement = 0;
    let msqCount = 0;
    for (const { first, latest } of msqByMember.values()) {
      if (first > 0) {
        const improvement = ((first - latest) / first) * 100;
        totalMsqImprovement += improvement;
        msqCount++;
      }
    }
    const avgMsqImprovement = msqCount > 0 ? totalMsqImprovement / msqCount : 0;

    // Query 4: Completion rate (expected vs actual MSQ surveys)
    // Expected: 12 MSQ per member
    const expectedPerMember = 12;
    const { count: totalMsqSurveys } = await supabase
      .from('survey_response_sessions')
      .select('*', { count: 'exact' })
      .eq('form_id', 3) // MSQ-95 only
      .gte('completed_on', dateThreshold.toISOString());

    const expectedTotal = totalMembers * expectedPerMember;
    const completionRate = expectedTotal > 0 ? ((totalMsqSurveys || 0) / expectedTotal) * 100 : 0;

    // Query 5: Recent surveys (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: recentSurveysCount } = await supabase
      .from('survey_response_sessions')
      .select('*', { count: 'exact' })
      .gte('completed_on', sevenDaysAgo.toISOString());

    // Query 6: Prior period surveys (8-14 days ago)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const { count: priorPeriodCount } = await supabase
      .from('survey_response_sessions')
      .select('*', { count: 'exact' })
      .gte('completed_on', fourteenDaysAgo.toISOString())
      .lt('completed_on', sevenDaysAgo.toISOString());

    const recentSurveysChange =
      priorPeriodCount && priorPeriodCount > 0
        ? (((recentSurveysCount || 0) - priorPeriodCount) / priorPeriodCount) * 100
        : 0;

    // Construct summary response
    const summary: ReportCardSummary = {
      total_participants: totalMembers, // Renamed to total_members conceptually, but keeping field name for backwards compatibility
      participants_with_baseline: membersWithBaseline,
      avg_msq_improvement: Math.round(avgMsqImprovement * 10) / 10,
      avg_promis_improvement: 0, // Deprecated, keeping for backwards compatibility
      completion_rate: Math.round(completionRate * 10) / 10,
      recent_surveys_count: recentSurveysCount || 0,
      recent_surveys_change: Math.round(recentSurveysChange * 10) / 10,
    };

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error('Report card summary API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions for quick score mapping
function getMsqAnswerScore(answer: string | null): number {
  if (!answer) return 0;
  const map: Record<string, number> = {
    Never: 0,
    Rarely: 1,
    Sometimes: 2,
    Frequently: 3,
    Always: 4,
  };
  return map[answer.trim()] || 0;
}

