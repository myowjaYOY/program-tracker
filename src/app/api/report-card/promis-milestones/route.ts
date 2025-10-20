import { NextResponse } from 'next/server';

/**
 * GET /api/report-card/promis-milestones
 * 
 * DEPRECATED: PROMIS-29 removed from Report Card Dashboard (Phase 1 cleanup)
 * 
 * This endpoint returns 410 Gone. The Report Card Dashboard now focuses
 * exclusively on MSQ-95 clinical analysis.
 * 
 * For historical PROMIS data access, query survey_response_sessions directly
 * with form_id = 6 (PROMIS-29).
 * 
 * Deprecated: 2025-10-18
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'PROMIS-29 endpoint deprecated',
      message:
        'The Report Card Dashboard now focuses exclusively on MSQ-95 analysis. ' +
        'PROMIS-29 data can be accessed directly from survey_response_sessions (form_id = 6).',
      deprecated_date: '2025-10-18',
    },
    { status: 410 } // 410 Gone - Resource no longer available
  );
}

