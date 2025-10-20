import { NextRequest, NextResponse } from 'next/server';
import { generateFoodTriggers } from '@/lib/utils/msq-assessment';
import type { MsqDomainCard } from '@/types/database.types';

/**
 * GET /api/report-card/food-triggers/:memberId
 * 
 * Returns rule-based food trigger analysis for a specific member.
 * 
 * This endpoint delegates to the main msq-assessment endpoint to get domain cards,
 * then applies food trigger rules.
 * 
 * @param memberId - external_user_id from survey_user_mappings
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await context.params;

    // Fetch the full assessment data (includes domains)
    const baseUrl = request.nextUrl.origin;
    const assessmentResponse = await fetch(
      `${baseUrl}/api/report-card/msq-assessment/${memberId}`,
      {
        headers: {
          Cookie: request.headers.get('Cookie') || '',
        },
      }
    );

    if (!assessmentResponse.ok) {
      const error = await assessmentResponse.json();
      return NextResponse.json(
        { error: error.error || 'Failed to fetch assessment data' },
        { status: assessmentResponse.status }
      );
    }

    const assessmentData = await assessmentResponse.json();
    const domainCards: MsqDomainCard[] = assessmentData.data.domains;

    // Generate food triggers based on domain data
    const foodTriggers = generateFoodTriggers(domainCards);

    return NextResponse.json({
      data: foodTriggers,
    });
  } catch (error) {
    console.error('Food Triggers API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
