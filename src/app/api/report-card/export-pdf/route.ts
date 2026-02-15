/**
 * Report Card PDF Export API Route
 * 
 * POST /api/report-card/export-pdf
 * 
 * Generates a PDF report for a member using @react-pdf/renderer.
 * This replaces the previous Puppeteer-based implementation.
 * 
 * Benefits:
 * - No Chrome/Chromium binary required
 * - Works natively in Vercel serverless (no timeout issues)
 * - ~5-10x faster generation
 * - ~50MB smaller deployment bundle
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReportCardPdf } from '@/lib/utils/pdf-generator';
import { fetchReportCardData } from '@/lib/utils/report-data-fetcher';

// Force Node.js runtime for PDF generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Increase max duration for PDF generation (default is 10s on Vercel Hobby)
export const maxDuration = 30;

interface ExportRequest {
  memberId: number;
  sections: {
    memberProgress: boolean;
    msqAssessment: boolean;
    promisAssessment: boolean;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: ExportRequest = await request.json();
    const { memberId, sections } = body;

    if (!memberId || !sections) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, sections' },
        { status: 400 }
      );
    }

    console.log(`📊 Export PDF request for member ${memberId}`);
    console.log(`   Sections: ${JSON.stringify(sections)}`);

    // 3. Fetch report data server-side
    const reportData = await fetchReportCardData(supabase, memberId, { sections });

    console.log('📊 Report data fetched:', {
      hasMember: !!reportData?.member,
      memberName: reportData?.member?.name,
      hasMemberProgress: !!reportData?.memberProgress,
      hasMsqAssessment: !!reportData?.msqAssessment,
      hasPromisAssessment: !!reportData?.promisAssessment,
    });

    if (!reportData || !reportData.member) {
      return NextResponse.json(
        { error: 'Member not found or no data available' },
        { status: 404 }
      );
    }

    // 4. Format the report date
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 5. Generate PDF using @react-pdf/renderer
    const pdfBuffer = await generateReportCardPdf({
      memberName: reportData.member.name,
      reportDate,
      sections,
      data: {
        memberProgress: sections.memberProgress ? reportData.memberProgress : undefined,
        msqAssessment: sections.msqAssessment ? reportData.msqAssessment : undefined,
        promisAssessment: sections.promisAssessment ? reportData.promisAssessment : undefined,
      },
    });

    // 6. Return PDF as response
    const filename = `Report-Card-${reportData.member.firstName}-${reportData.member.lastName}-${new Date().toISOString().split('T')[0]}.pdf`;

    const duration = Date.now() - startTime;
    console.log(`✅ PDF export completed in ${duration}ms`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'X-Generation-Time-Ms': duration.toString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Export PDF error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        error: 'Failed to generate PDF report',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}