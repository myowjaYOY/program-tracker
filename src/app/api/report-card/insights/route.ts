import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateMsqImprovement,
  interpretMsqScore,
} from '@/lib/utils/survey-scoring';
import type {
  ReportCardInsights,
  ReportCardInsight,
  MsqScore,
} from '@/types/database.types';

/**
 * GET /api/report-card/insights
 * 
 * Auto-generates insights based on MSQ data trends
 * 
 * Query params:
 * - external_user_id (required): Survey participant to analyze
 * - program_id (optional): Filter by specific program
 * 
 * Response: ReportCardInsights object with improvements, concerns, and summary
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
    const externalUserId = searchParams.get('external_user_id');
    const programId = searchParams.get('program_id');

    if (!externalUserId) {
      return NextResponse.json(
        { error: 'external_user_id is required' },
        { status: 400 }
      );
    }

    // Fetch MSQ timeline data
    const msqParams = new URLSearchParams({ external_user_id: externalUserId });
    if (programId) msqParams.set('program_id', programId);

    const msqResponse = await fetch(
      `${request.nextUrl.origin}/api/report-card/msq-timeline?${msqParams}`,
      {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );
    const msqData = await msqResponse.json();
    const msqScores: MsqScore[] = msqData.data || [];

    // Initialize insights
    const improvements: ReportCardInsight[] = [];
    const concerns: ReportCardInsight[] = [];
    const stableAreas: ReportCardInsight[] = [];

    // Analyze MSQ trends
    if (msqScores.length >= 2) {
      const msqBaseline = msqScores[0]!;
      const msqLatest = msqScores[msqScores.length - 1]!;
      const improvement = calculateMsqImprovement(
        msqBaseline.total_score,
        msqLatest.total_score
      );

      if (improvement >= 25) {
        improvements.push({
          type: 'improvement',
          category: 'msq',
          title: 'Significant MSQ Improvement',
          message: `Total symptom burden decreased by ${improvement.toFixed(1)}% from baseline (${msqBaseline.total_score}) to current (${msqLatest.total_score}). ${interpretMsqScore(msqLatest.total_score)}.`,
          change_value: improvement,
          significance: 'large',
        });
      } else if (improvement >= 10) {
        improvements.push({
          type: 'improvement',
          category: 'msq',
          title: 'Moderate MSQ Improvement',
          message: `Symptom burden improved by ${improvement.toFixed(1)}%. Current level: ${interpretMsqScore(msqLatest.total_score)}.`,
          change_value: improvement,
          significance: 'moderate',
        });
      } else if (improvement < -10) {
        concerns.push({
          type: 'worsening',
          category: 'msq',
          title: 'MSQ Score Increased',
          message: `Symptom burden increased by ${Math.abs(improvement).toFixed(1)}%. May require intervention or protocol adjustment.`,
          change_value: improvement,
          significance: 'moderate',
        });
      } else {
        stableAreas.push({
          type: 'stable',
          category: 'msq',
          title: 'MSQ Stable',
          message: `Symptom burden relatively stable with ${Math.abs(improvement).toFixed(1)}% change.`,
          change_value: improvement,
          significance: 'small',
        });
      }

      // Analyze top improving domains
      const domainImprovements: { domain: string; improvement: number }[] = [];
      for (const domain of Object.keys(msqBaseline.domain_scores) as Array<
        keyof typeof msqBaseline.domain_scores
      >) {
        const baseScore = msqBaseline.domain_scores[domain];
        const latestScore = msqLatest.domain_scores[domain];
        if (baseScore > 0) {
          const domainImprovement = ((baseScore - latestScore) / baseScore) * 100;
          domainImprovements.push({
            domain: domain.replace(/_/g, ' '),
            improvement: domainImprovement,
          });
        }
      }

      domainImprovements.sort((a, b) => b.improvement - a.improvement);

      const topDomain = domainImprovements[0];
      if (topDomain && topDomain.improvement >= 30) {
        improvements.push({
          type: 'improvement',
          category: 'msq',
          title: 'Top Improving Domain',
          message: `${topDomain.domain} symptoms improved by ${topDomain.improvement.toFixed(1)}%.`,
          change_value: topDomain.improvement,
          significance: 'moderate',
        });
      }
    }

    // Generate overall summary
    let summary = '';
    if (improvements.length > 0 && concerns.length === 0) {
      summary = `Excellent progress! Showing ${improvements.length} areas of improvement with no concerning trends.`;
    } else if (improvements.length > concerns.length) {
      summary = `Good progress overall with ${improvements.length} improvements, though ${concerns.length} area(s) need attention.`;
    } else if (improvements.length === concerns.length && improvements.length > 0) {
      summary = `Mixed results: ${improvements.length} improvements balanced with ${concerns.length} concern(s). Continue monitoring.`;
    } else if (concerns.length > improvements.length) {
      summary = `Needs attention: ${concerns.length} concerning trend(s) identified. Consider protocol adjustments.`;
    } else {
      summary = 'Insufficient data for comprehensive analysis. Continue collecting survey responses.';
    }

    const insights: ReportCardInsights = {
      improvements,
      concerns,
      stable_areas: stableAreas,
      summary,
    };

    return NextResponse.json({ data: insights });
  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

