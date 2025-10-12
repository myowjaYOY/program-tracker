import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔄 Syncing contracted_at_margin for Active programs...\n');

    // Get all Active programs with finances
    const { data: programs, error: programsError } = await supabase
      .from('member_programs')
      .select(`
        member_program_id,
        program_template_name,
        program_status(status_name),
        member_program_finances(
          member_program_finance_id,
          margin,
          contracted_at_margin
        )
      `)
      .order('member_program_id');

    if (programsError) {
      return NextResponse.json({ error: programsError.message }, { status: 500 });
    }

    const results = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const program of programs || []) {
      const statusName = (program.program_status as any)?.status_name || '';
      const isActive = statusName.toLowerCase() === 'active';
      
      const finances = (program.member_program_finances as any)?.[0];
      
      if (!finances) {
        skippedCount++;
        results.push({
          programId: program.member_program_id,
          name: program.program_template_name,
          status: statusName,
          reason: 'No finances record',
          updated: false,
        });
        continue;
      }

      if (!isActive) {
        skippedCount++;
        results.push({
          programId: program.member_program_id,
          name: program.program_template_name,
          status: statusName,
          reason: 'Not Active',
          updated: false,
        });
        continue;
      }

      const currentMargin = Number(finances.margin || 0);
      const contractedAtMargin = Number(finances.contracted_at_margin || 0);
      const difference = Math.abs(currentMargin - contractedAtMargin);

      // Only update if there's a difference
      if (difference > 0.01) {
        const { error: updateError } = await supabase
          .from('member_program_finances')
          .update({
            contracted_at_margin: currentMargin,
            updated_by: session.user.id,
          })
          .eq('member_program_finance_id', finances.member_program_finance_id);

        if (updateError) {
          results.push({
            programId: program.member_program_id,
            name: program.program_template_name,
            status: statusName,
            error: updateError.message,
            updated: false,
          });
          console.error(`❌ Failed to update Program ${program.member_program_id}:`, updateError);
        } else {
          updatedCount++;
          results.push({
            programId: program.member_program_id,
            name: program.program_template_name,
            status: statusName,
            oldContractedMargin: contractedAtMargin,
            newContractedMargin: currentMargin,
            difference: difference,
            updated: true,
          });
          console.log(`✅ Program ${program.member_program_id}: contracted_at_margin ${contractedAtMargin.toFixed(2)}% → ${currentMargin.toFixed(2)}%`);
        }
      } else {
        skippedCount++;
        results.push({
          programId: program.member_program_id,
          name: program.program_template_name,
          status: statusName,
          margin: currentMargin,
          contractedAtMargin: contractedAtMargin,
          reason: 'Already in sync',
          updated: false,
        });
      }
    }

    console.log('\n✅ Sync Complete!');
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalPrograms: programs?.length || 0,
        updated: updatedCount,
        skipped: skippedCount,
      },
      results,
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

