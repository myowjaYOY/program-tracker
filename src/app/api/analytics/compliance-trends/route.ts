import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface MonthlyComplianceData {
  month: string;
  nutrition: number | null;
  supplements: number | null;
  exercise: number | null;
  meditation: number | null;
  member_count: number;
  survey_count: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query to calculate monthly compliance for last 12 months
    // Only for members on Active, Completed, or Paused programs
    const { data, error } = await supabase.rpc('get_monthly_compliance_trends');

    if (error) {
      console.error('Error fetching compliance trends:', error);
      return NextResponse.json(
        { error: 'Failed to fetch compliance trends', details: error.message },
        { status: 500 }
      );
    }

    // Ensure we have 12 months of data, fill in missing months with nulls if needed
    const last12Months: MonthlyComplianceData[] = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = month.toISOString().substring(0, 7); // "YYYY-MM"
      
      const monthData = data?.find((d: any) => d.month?.substring(0, 7) === monthKey);
      
      last12Months.push({
        month: monthKey,
        nutrition: monthData?.nutrition ?? null,
        supplements: monthData?.supplements ?? null,
        exercise: monthData?.exercise ?? null,
        meditation: monthData?.meditation ?? null,
        member_count: monthData?.member_count ?? 0,
        survey_count: monthData?.survey_count ?? 0
      });
    }

    return NextResponse.json(last12Months);
  } catch (error: any) {
    console.error('Compliance trends error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

