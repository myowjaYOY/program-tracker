import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProgramOption } from '@/types/database.types';

/**
 * GET /api/report-card/programs
 * 
 * Returns list of survey programs with survey data for filtering
 * 
 * Response includes:
 * - program_id
 * - program_name
 * - participant_count
 * - survey_count
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

    // Query survey programs with their context data
    const { data: programData, error } = await supabase
      .from('survey_session_program_context')
      .select(`
        program_id,
        session_id,
        survey_programs!inner (
          program_id,
          program_name
        ),
        survey_response_sessions!inner (
          lead_id
        )
      `)
      .order('program_id');

    if (error) {
      console.error('Error fetching programs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch programs' },
        { status: 500 }
      );
    }

    // Aggregate program data
    const programMap = new Map<
      number,
      {
        program_id: number;
        program_name: string;
        lead_ids: Set<number>;
        survey_count: number;
      }
    >();

    for (const row of programData || []) {
      const programId = row.program_id;
      const programName = (row.survey_programs as any).program_name;
      const leadId = (row.survey_response_sessions as any).lead_id;

      if (!programMap.has(programId)) {
        programMap.set(programId, {
          program_id: programId,
          program_name: programName,
          lead_ids: new Set(),
          survey_count: 0,
        });
      }

      const program = programMap.get(programId)!;
      program.lead_ids.add(leadId);
      program.survey_count += 1;
    }

    // Convert to ProgramOption array
    const programs: ProgramOption[] = Array.from(programMap.values()).map((p) => ({
      program_id: p.program_id,
      program_name: p.program_name,
      participant_count: p.lead_ids.size,
      survey_count: p.survey_count,
    }));

    // Sort by program name
    programs.sort((a, b) => a.program_name.localeCompare(b.program_name));

    return NextResponse.json({ data: programs });
  } catch (error) {
    console.error('Programs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


