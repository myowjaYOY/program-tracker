import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchReportCardData } from '@/lib/utils/report-data-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { session },
            error: authError,
        } = await supabase.auth.getSession();

        if (authError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { memberId, sections } = await request.json();

        if (!memberId) {
            return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
        }

        const reportData = await fetchReportCardData(supabase, memberId, { sections });

        return NextResponse.json({ data: reportData });
    } catch (error) {
        console.error('Error fetching report data:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch report data',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
