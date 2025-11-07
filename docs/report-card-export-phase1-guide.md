# Report Card Export - Phase 1 Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing Phase 1 of the Report Card Export feature, focusing on the **Member Progress tab** as a proof of concept.

## Phase 1 Goals

✅ Create foundation for PDF export system  
✅ Implement print-optimized Member Progress component  
✅ Build PDF generation utility with Puppeteer  
✅ Create export API route  
✅ Add export button and modal to Report Card page  
✅ Deliver working proof of concept  

**Estimated Time:** 20 hours (2-3 days)

---

## Implementation Checklist

### Step 1: Create Print Styles Utility (1 hour)

**File:** `src/components/report-card/print/print-styles.ts`

```typescript
export const printStyles = {
  // Master page layout
  page: {
    width: '8.5in',
    minHeight: '11in',
    padding: '0.75in 0.5in',
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: 'Arial, sans-serif',
    '@media print': {
      margin: 0,
      padding: 0,
    },
  },

  // Report header
  header: {
    marginBottom: '24px',
    borderBottom: '3px solid #8e24ff',
    paddingBottom: '16px',
  },

  // Section styles
  section: {
    marginBottom: '32px',
    pageBreakInside: 'avoid',
  },

  sectionTitle: {
    fontWeight: 700,
    fontSize: '20px',
    marginBottom: '16px',
    color: '#8e24ff',
    borderBottom: '2px solid #8e24ff',
    paddingBottom: '8px',
  },

  subsection: {
    marginBottom: '24px',
    pageBreakInside: 'avoid',
  },

  subsectionTitle: {
    fontWeight: 600,
    fontSize: '16px',
    marginBottom: '12px',
    color: '#333333',
  },

  // Data display
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },

  dataItem: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    borderLeft: '3px solid #8e24ff',
  },

  label: {
    fontSize: '12px',
    color: '#666666',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  value: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#333333',
  },

  // Table styles
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '16px',
    '& thead': {
      backgroundColor: '#f5f5f5',
    },
    '& th': {
      padding: '12px',
      textAlign: 'left',
      fontWeight: 600,
      fontSize: '14px',
      borderBottom: '2px solid #8e24ff',
      color: '#333333',
    },
    '& td': {
      padding: '12px',
      fontSize: '14px',
      borderBottom: '1px solid #e0e0e0',
    },
    '& tbody tr:last-child td': {
      borderBottom: 'none',
    },
  },

  // Footer
  footer: {
    marginTop: '48px',
    paddingTop: '16px',
    borderTop: '1px solid #e0e0e0',
    fontSize: '12px',
    color: '#999999',
    textAlign: 'center',
  },

  // Page break utilities
  pageBreakBefore: {
    pageBreakBefore: 'always',
  },

  pageBreakAfter: {
    pageBreakAfter: 'always',
  },

  noPageBreak: {
    pageBreakInside: 'avoid',
  },
};
```

**Testing:** Import and verify TypeScript compilation

---

### Step 2: Create Print Header/Footer Components (2 hours)

**File:** `src/components/report-card/print/PrintHeader.tsx`

```typescript
'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { printStyles } from './print-styles';

interface PrintHeaderProps {
  memberName: string;
  reportDate: string;
  logo?: string; // Optional logo URL
}

export default function PrintHeader({
  memberName,
  reportDate,
  logo,
}: PrintHeaderProps) {
  return (
    <Box sx={printStyles.header}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Logo */}
        {logo && (
          <Box sx={{ width: '150px', height: '50px' }}>
            <img
              src={logo}
              alt="Company Logo"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>
        )}

        {/* Report Title */}
        <Box sx={{ textAlign: logo ? 'center' : 'left', flex: 1 }}>
          <Typography variant="h4" fontWeight="bold" color="primary.main">
            Member Progress Report
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {memberName}
          </Typography>
        </Box>

        {/* Report Date */}
        <Box sx={{ textAlign: 'right', minWidth: '120px' }}>
          <Typography variant="caption" color="textSecondary" display="block">
            Generated On
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {reportDate}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
```

**File:** `src/components/report-card/print/PrintFooter.tsx`

```typescript
'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { printStyles } from './print-styles';

interface PrintFooterProps {
  confidentialityNotice?: string;
}

export default function PrintFooter({
  confidentialityNotice = 'This report contains confidential health information. Please handle with appropriate privacy and security measures.',
}: PrintFooterProps) {
  return (
    <Box sx={printStyles.footer}>
      <Typography variant="caption" display="block" gutterBottom>
        {confidentialityNotice}
      </Typography>
      <Typography variant="caption" color="textSecondary">
        © {new Date().getFullYear()} Program Tracker. All rights reserved.
      </Typography>
    </Box>
  );
}
```

**Testing:** Create simple page to preview these components

---

### Step 3: Create Print-Optimized Member Progress Component (6 hours)

**File:** `src/components/report-card/print/PrintMemberProgress.tsx`

```typescript
'use client';

import React from 'react';
import { Box, Typography, Grid, Divider } from '@mui/material';
import { MemberProgressDashboardData } from '@/types/database.types';
import { printStyles } from './print-styles';

interface PrintMemberProgressProps {
  data: MemberProgressDashboardData;
}

export default function PrintMemberProgress({ data }: PrintMemberProgressProps) {
  return (
    <Box sx={printStyles.section}>
      {/* Section Title */}
      <Typography variant="h5" sx={printStyles.sectionTitle}>
        Member Progress Dashboard
      </Typography>

      {/* Profile Information */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Member Profile
        </Typography>
        <Box sx={printStyles.dataGrid}>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Member Name</Typography>
            <Typography sx={printStyles.value}>
              {data.first_name} {data.last_name}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Program</Typography>
            <Typography sx={printStyles.value}>
              {data.program_template_name || 'N/A'}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Start Date</Typography>
            <Typography sx={printStyles.value}>
              {data.program_start_date
                ? new Date(data.program_start_date).toLocaleDateString()
                : 'N/A'}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Days in Program</Typography>
            <Typography sx={printStyles.value}>
              {data.days_in_program || 0}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Curriculum Progress */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Curriculum Progress
        </Typography>
        <Box sx={printStyles.dataGrid}>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Current Week</Typography>
            <Typography sx={printStyles.value}>
              Week {data.current_week} of {data.total_weeks}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Progress</Typography>
            <Typography sx={printStyles.value}>
              {Math.round((data.current_week / data.total_weeks) * 100)}%
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Status</Typography>
            <Typography sx={printStyles.value}>
              {data.curriculum_status || 'In Progress'}
            </Typography>
          </Box>
        </Box>

        {/* Timeline of Completed Modules */}
        {data.completed_modules && data.completed_modules.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              Completed Modules
            </Typography>
            <Box component="table" sx={printStyles.table}>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Completed Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.completed_modules.map((module, idx) => (
                  <tr key={idx}>
                    <td>{module.module_name}</td>
                    <td>
                      {module.completed_date
                        ? new Date(module.completed_date).toLocaleDateString()
                        : 'In Progress'}
                    </td>
                    <td>{module.status}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        )}
      </Box>

      {/* Goals */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Goals in Progress
        </Typography>
        {data.goals_in_progress && data.goals_in_progress.length > 0 ? (
          <Box component="ul" sx={{ margin: 0, paddingLeft: '24px' }}>
            {data.goals_in_progress.map((goal, idx) => (
              <Box component="li" key={idx} sx={{ marginBottom: '8px' }}>
                <Typography variant="body2">
                  <strong>{goal.goal_name}</strong> - {goal.description}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Target: {goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'Not set'}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            No active goals
          </Typography>
        )}
      </Box>

      {/* Wins */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Recent Wins
        </Typography>
        {data.recent_wins && data.recent_wins.length > 0 ? (
          <Box component="ul" sx={{ margin: 0, paddingLeft: '24px' }}>
            {data.recent_wins.map((win, idx) => (
              <Box component="li" key={idx} sx={{ marginBottom: '8px' }}>
                <Typography variant="body2">{win.description}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {new Date(win.date).toLocaleDateString()}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            No wins recorded yet
          </Typography>
        )}
      </Box>

      {/* Challenges */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Current Challenges
        </Typography>
        {data.current_challenges && data.current_challenges.length > 0 ? (
          <Box component="ul" sx={{ margin: 0, paddingLeft: '24px' }}>
            {data.current_challenges.map((challenge, idx) => (
              <Box component="li" key={idx} sx={{ marginBottom: '8px' }}>
                <Typography variant="body2">{challenge.description}</Typography>
                <Typography variant="caption" color="textSecondary">
                  Status: {challenge.status}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            No challenges reported
          </Typography>
        )}
      </Box>

      {/* Health Vitals */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Health Vitals
        </Typography>
        <Box sx={printStyles.dataGrid}>
          {data.health_vitals?.weight && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Weight</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.weight} lbs
              </Typography>
            </Box>
          )}
          {data.health_vitals?.blood_pressure && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Blood Pressure</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.blood_pressure}
              </Typography>
            </Box>
          )}
          {data.health_vitals?.glucose && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Glucose</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.glucose} mg/dL
              </Typography>
            </Box>
          )}
          {data.health_vitals?.heart_rate && (
            <Box sx={printStyles.dataItem}>
              <Typography sx={printStyles.label}>Heart Rate</Typography>
              <Typography sx={printStyles.value}>
                {data.health_vitals.heart_rate} bpm
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Protocol Compliance */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Protocol Compliance
        </Typography>
        <Box sx={printStyles.dataGrid}>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Overall Compliance</Typography>
            <Typography sx={printStyles.value}>
              {data.compliance_percentage || 0}%
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Supplements Taken</Typography>
            <Typography sx={printStyles.value}>
              {data.supplements_taken || 0} / {data.supplements_prescribed || 0}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Meals Logged</Typography>
            <Typography sx={printStyles.value}>
              {data.meals_logged || 0}
            </Typography>
          </Box>
          <Box sx={printStyles.dataItem}>
            <Typography sx={printStyles.label}>Exercise Sessions</Typography>
            <Typography sx={printStyles.value}>
              {data.exercise_sessions || 0}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Data Freshness */}
      <Box sx={{ marginTop: '32px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <Typography variant="caption" color="textSecondary" fontStyle="italic">
          ℹ️ Dashboard metrics are pre-calculated and updated automatically after each survey import.
          {data.calculated_at && ` Last calculated: ${new Date(data.calculated_at).toLocaleString()}`}
        </Typography>
      </Box>
    </Box>
  );
}
```

**Testing:** 
1. Create test page with sample data
2. Verify all fields render correctly
3. Check print preview in browser (Ctrl+P)

---

### Step 4: Create Print Report Layout Wrapper (2 hours)

**File:** `src/components/report-card/print/PrintReportLayout.tsx`

```typescript
'use client';

import React from 'react';
import { Box } from '@mui/material';
import { printStyles } from './print-styles';
import PrintHeader from './PrintHeader';
import PrintFooter from './PrintFooter';

interface PrintReportLayoutProps {
  memberName: string;
  reportDate?: string;
  logo?: string;
  children: React.ReactNode;
}

export default function PrintReportLayout({
  memberName,
  reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  logo,
  children,
}: PrintReportLayoutProps) {
  return (
    <Box sx={printStyles.page}>
      <PrintHeader
        memberName={memberName}
        reportDate={reportDate}
        logo={logo}
      />
      
      {children}
      
      <PrintFooter />
    </Box>
  );
}
```

**Testing:** Wrap PrintMemberProgress in layout and verify header/footer

---

### Step 5: Create PDF Generation Utility (3 hours)

**File:** `src/lib/utils/pdf-generator.ts`

```typescript
import puppeteer, { Browser, Page } from 'puppeteer';

export interface PdfGenerationOptions {
  html: string;
  filename: string;
  format?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export async function generatePdfFromHtml(
  options: PdfGenerationOptions
): Promise<Buffer> {
  const {
    html,
    format = 'Letter',
    landscape = false,
    margin = {
      top: '0.75in',
      right: '0.5in',
      bottom: '0.75in',
      left: '0.5in',
    },
  } = options;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('🚀 Launching Puppeteer...');
    
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security', // Allow loading local resources
      ],
    });

    page = await browser.newPage();

    console.log('📄 Setting HTML content...');
    
    // Set content with proper base URL for assets
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000, // 30 second timeout
    });

    console.log('⏳ Waiting for dynamic content...');
    
    // Wait for any dynamic content to render
    // This is especially important for charts
    await page.waitForTimeout(1500);

    // Optionally wait for specific elements
    try {
      await page.waitForSelector('[data-print-ready="true"]', { timeout: 5000 });
    } catch {
      // Element not found, continue anyway
      console.log('⚠️ Print-ready marker not found, continuing...');
    }

    console.log('📝 Generating PDF...');
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin,
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false, // We handle headers/footers in HTML
    });

    console.log('✅ PDF generated successfully!');
    
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    // Always clean up resources
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Helper function to wrap HTML content with necessary styles and scripts
 */
export function wrapHtmlForPdf(bodyHtml: string, additionalStyles?: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Report Card</title>
      <style>
        /* Base styles */
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Print media styles */
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          
          @page {
            margin: 0;
            size: letter;
          }
        }

        /* Additional custom styles */
        ${additionalStyles || ''}
      </style>
    </head>
    <body data-print-ready="true">
      ${bodyHtml}
    </body>
    </html>
  `;
}
```

**Testing:**
1. Create simple test HTML
2. Generate PDF
3. Verify output quality

---

### Step 6: Create Server-Side Data Fetcher (2 hours)

**File:** `src/lib/utils/report-data-fetcher.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { MemberProgressDashboardData } from '@/types/database.types';

export interface ReportDataOptions {
  sections: {
    memberProgress: boolean;
    msqAssessment: boolean;
    promisAssessment: boolean;
  };
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

export interface ReportCardData {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    name: string;
    email?: string;
    phone?: string;
  };
  memberProgress?: MemberProgressDashboardData;
  msqAssessment?: any; // Phase 2
  promisAssessment?: any; // Phase 2
}

export async function fetchReportCardData(
  supabase: SupabaseClient,
  memberId: number,
  options: ReportDataOptions
): Promise<ReportCardData> {
  try {
    // Fetch member basic info
    const { data: member, error: memberError } = await supabase
      .from('leads')
      .select('lead_id, first_name, last_name, email, phone')
      .eq('lead_id', memberId)
      .single();

    if (memberError || !member) {
      throw new Error(`Member not found: ${memberError?.message || 'Unknown error'}`);
    }

    const reportData: ReportCardData = {
      member: {
        id: member.lead_id,
        firstName: member.first_name,
        lastName: member.last_name,
        name: `${member.first_name} ${member.last_name}`,
        email: member.email || undefined,
        phone: member.phone || undefined,
      },
    };

    // Fetch Member Progress data if requested
    if (options.sections.memberProgress) {
      const { data: progressData, error: progressError } = await supabase
        .from('member_progress_dashboard')
        .select('*')
        .eq('lead_id', memberId)
        .maybeSingle();

      if (progressError) {
        console.error('Error fetching member progress:', progressError);
        // Don't throw - allow partial data
      } else if (progressData) {
        reportData.memberProgress = progressData as MemberProgressDashboardData;
      }
    }

    // TODO: Phase 2 - Fetch MSQ Assessment data
    if (options.sections.msqAssessment) {
      // Placeholder for now
      reportData.msqAssessment = null;
    }

    // TODO: Phase 2 - Fetch PROMIS-29 data
    if (options.sections.promisAssessment) {
      // Placeholder for now
      reportData.promisAssessment = null;
    }

    return reportData;
  } catch (error) {
    console.error('Error fetching report card data:', error);
    throw error;
  }
}
```

**Testing:** Create test script to verify data fetching

---

### Step 7: Create Export API Route (2 hours)

**File:** `src/app/api/report-card/export-pdf/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generatePdfFromHtml, wrapHtmlForPdf } from '@/lib/utils/pdf-generator';
import { fetchReportCardData } from '@/lib/utils/report-data-fetcher';
import { renderToString } from 'react-dom/server';
import PrintReportLayout from '@/components/report-card/print/PrintReportLayout';
import PrintMemberProgress from '@/components/report-card/print/PrintMemberProgress';
import React from 'react';

interface ExportRequest {
  memberId: number;
  sections: {
    memberProgress: boolean;
    msqAssessment: boolean;
    promisAssessment: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Received PDF export request');
    
    // 1. Authenticate user
    const supabase = await createServerClient();
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

    console.log(`👤 Fetching data for member ID: ${memberId}`);
    
    // 3. Fetch report data server-side
    const reportData = await fetchReportCardData(supabase, memberId, { sections });

    // 4. Render React components to HTML string
    console.log('🎨 Rendering React components...');
    
    const reportContent = React.createElement(
      PrintReportLayout,
      {
        memberName: reportData.member.name,
        reportDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      sections.memberProgress && reportData.memberProgress
        ? React.createElement(PrintMemberProgress, { data: reportData.memberProgress })
        : null
    );

    const htmlContent = renderToString(reportContent);
    const fullHtml = wrapHtmlForPdf(htmlContent);

    // 5. Generate PDF using Puppeteer
    console.log('📄 Generating PDF...');
    
    const pdfBuffer = await generatePdfFromHtml({
      html: fullHtml,
      filename: `report-card-${reportData.member.name}.pdf`,
      format: 'Letter',
      margin: {
        top: '0.75in',
        right: '0.5in',
        bottom: '0.75in',
        left: '0.5in',
      },
    });

    // 6. Return PDF as response
    const filename = `Report-Card-${reportData.member.firstName}-${reportData.member.lastName}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    console.log(`✅ PDF generated successfully: ${filename}`);
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('❌ Export PDF error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate PDF report',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

**Testing:**
1. Use Postman or curl to test endpoint
2. Verify PDF downloads correctly
3. Check PDF content quality

---

### Step 8: Create Export Modal Component (1 hour)

**File:** `src/components/report-card/ExportReportModal.tsx`

(Use full implementation from main design doc - see above)

**Testing:** 
1. Open modal in Storybook or test page
2. Verify all options work
3. Test export flow

---

### Step 9: Integrate with Report Card Page (1 hour)

**File:** `src/app/dashboard/report-card/page.tsx`

**Changes:**

```typescript
// Add imports at top
import DownloadIcon from '@mui/icons-material/Download';
import ExportReportModal from '@/components/report-card/ExportReportModal';

// Add state variable (around line 51)
const [isExportModalOpen, setIsExportModalOpen] = useState(false);

// Add export button in header (around line 145, after Notes button)
<Tooltip title="Export Report">
  <IconButton
    onClick={() => setIsExportModalOpen(true)}
    color="primary"
    disabled={!selectedMember}
  >
    <DownloadIcon />
  </IconButton>
</Tooltip>

// Add modal before closing </Box> (around line 228)
{selectedMember && (
  <ExportReportModal
    open={isExportModalOpen}
    onClose={() => setIsExportModalOpen(false)}
    memberId={selectedMember.lead_id}
    memberName={selectedMember.full_name}
  />
)}
```

**Testing:** 
1. Open Report Card page
2. Select a member
3. Click export button
4. Verify modal opens
5. Complete export and verify PDF downloads

---

## Testing Checklist

### Unit Tests
- [ ] Print styles compile without errors
- [ ] PrintHeader renders with all props
- [ ] PrintFooter renders correctly
- [ ] PrintMemberProgress handles missing data gracefully

### Integration Tests
- [ ] API route authenticates users
- [ ] API route fetches correct data
- [ ] PDF generation produces valid PDF file
- [ ] Modal submits correct options to API

### End-to-End Tests
- [ ] User can open export modal
- [ ] User can select sections to include
- [ ] PDF downloads successfully
- [ ] PDF contains correct data
- [ ] PDF is properly formatted
- [ ] Print quality is acceptable (view in Adobe Reader)

### Edge Cases
- [ ] Member with no progress data
- [ ] Member with incomplete data
- [ ] Very long text values
- [ ] Special characters in names
- [ ] Concurrent export requests

---

## Deployment Checklist

### Before Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] No console errors
- [ ] Puppeteer working on dev server
- [ ] PDF quality verified

### Environment Setup
- [ ] Verify Puppeteer dependencies on server
- [ ] Check server has sufficient memory (recommend 2GB minimum)
- [ ] Test Puppeteer launch on production environment
- [ ] Configure proper fonts on server

### Post-Deployment
- [ ] Test export on production
- [ ] Monitor server resource usage
- [ ] Check error logs for issues
- [ ] Gather user feedback

---

## Troubleshooting

### "Puppeteer failed to launch"
**Solution:** Ensure all dependencies are installed:
```bash
# On Linux
apt-get install -y chromium-browser

# Or install missing libraries
apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2
```

### "PDF is blank"
**Cause:** React components not rendering
**Solution:** 
1. Check `renderToString` output
2. Verify HTML is valid
3. Check browser console for errors

### "Charts not rendering"
**Cause:** Recharts needs time to render
**Solution:** Increase `waitForTimeout` in pdf-generator.ts

### "Memory errors"
**Cause:** Puppeteer using too much memory
**Solution:**
1. Ensure browsers are closed properly
2. Limit concurrent exports
3. Increase server memory

### "Styling looks wrong"
**Cause:** CSS not being applied
**Solution:**
1. Check `printBackground: true` in PDF options
2. Verify `@media print` styles
3. Test in browser print preview first

---

## Success Criteria

Phase 1 is complete when:
- ✅ User can click "Export" button on Report Card page
- ✅ Export modal opens with options
- ✅ User can select Member Progress section
- ✅ PDF downloads successfully
- ✅ PDF contains Member Progress data
- ✅ PDF is professionally formatted
- ✅ No errors in production logs

---

## Next Steps (Phase 2)

After Phase 1 is complete:
1. Create PrintMsqAssessment component
2. Create PrintPromisAssessment component
3. Add chart rendering support
4. Implement date range filtering
5. Add email delivery option

---

## Time Estimates

| Task | Estimated | Actual |
|------|-----------|--------|
| Print styles | 1 hour | |
| Header/Footer | 2 hours | |
| PrintMemberProgress | 6 hours | |
| Print layout | 2 hours | |
| PDF generator | 3 hours | |
| Data fetcher | 2 hours | |
| API route | 2 hours | |
| Export modal | 1 hour | |
| Integration | 1 hour | |
| **Total** | **20 hours** | |

---

## Resources

- [Puppeteer Documentation](https://pptr.dev/)
- [React renderToString](https://react.dev/reference/react-dom/server/renderToString)
- [CSS Print Styles Guide](https://www.smashingmagazine.com/2018/05/print-stylesheets-in-2018/)
- [Material-UI Server Rendering](https://mui.com/material-ui/guides/server-rendering/)










