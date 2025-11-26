# Report Card Export - Design Proposal

## Executive Summary

This document proposes a comprehensive solution for exporting Report Card data (Member Progress, MSQ Assessment, and PROMIS-29 results) into shareable PDF reports for members.

## Current State Analysis

### Existing Report Card Structure

The Report Card page (`/dashboard/report-card`) contains three main tabs:

1. **Member Progress Tab**
   - Profile card with member demographics and program info
   - Curriculum progress timeline
   - Goals in progress
   - Wins and challenges
   - Health vitals (weight, blood pressure, glucose, etc.)
   - Protocol compliance metrics

2. **MSQ Assessment Tab**
   - Patient-specific profile with 4 summary metrics
   - 3 clinical alert cards
   - 15 domain cards showing symptom scores and trends
   - Food trigger analysis (4 categories)
   - MSQ interpretation guide
   - Uses Recharts for data visualization

3. **PROMIS-29 Tab**
   - Summary profile card with mean T-score
   - 8 health domain cards with detailed scores
   - Historical trend analysis
   - PROMIS interpretation guide

### Existing Infrastructure

**Strengths:**
- ✅ **Puppeteer already installed** (v24.25.0) - perfect for server-side PDF generation
- ✅ Document generation pattern established (DOCX for quotes and plan summaries)
- ✅ Well-structured data hooks (React Query)
- ✅ Material UI components with consistent styling
- ✅ Recharts for data visualization

**Current Limitations:**
- ❌ No PDF export capability
- ❌ No print-optimized layouts
- ❌ No shareable report format for members

## Proposed Solution

### Architecture: Server-Side PDF Generation with Puppeteer

**Recommended Approach:** Hybrid rendering with dedicated print-optimized components

#### Why Puppeteer?
1. **Already installed** - zero new dependencies
2. **Perfect fidelity** - renders actual React components with full MUI styling
3. **Chart support** - Recharts renders perfectly in headless Chrome
4. **Professional output** - high-quality PDFs suitable for clinical documentation
5. **Proven technology** - industry standard for PDF generation from HTML

### Implementation Strategy

#### Phase 1: Print-Optimized React Components (Client-Side)
Create dedicated print-friendly versions of report card tabs that:
- Use printer-friendly layouts (no interactive elements)
- Apply CSS `@media print` styles
- Maintain brand consistency with on-screen versions
- Pre-render all charts as static SVGs
- Include page break controls

#### Phase 2: API Route for PDF Generation (Server-Side)
Create a new API endpoint that:
1. Accepts member ID and report configuration
2. Fetches all necessary data server-side
3. Renders print-optimized React components in headless browser
4. Generates PDF with proper page sizing and margins
5. Returns PDF as downloadable file or email attachment

#### Phase 3: User Interface Enhancements
Add export controls to the Report Card page:
- Export button in page header
- Export options modal (format, sections to include, date range)
- Progress indicator during generation
- Option to email report directly to member

## Detailed Technical Design

### 1. File Structure

```
src/
├── components/
│   ├── report-card/
│   │   ├── print/                           # NEW: Print-optimized components
│   │   │   ├── PrintMemberProgress.tsx      # Printer-friendly Member Progress
│   │   │   ├── PrintMsqAssessment.tsx       # Printer-friendly MSQ
│   │   │   ├── PrintPromisAssessment.tsx    # Printer-friendly PROMIS-29
│   │   │   ├── PrintReportLayout.tsx        # Master print layout wrapper
│   │   │   ├── PrintHeader.tsx              # Report header with logo
│   │   │   ├── PrintFooter.tsx              # Report footer with page numbers
│   │   │   └── print-styles.ts              # Shared print CSS-in-JS
│   │   └── ExportReportModal.tsx            # NEW: Export configuration modal
├── app/api/
│   └── report-card/
│       ├── export-pdf/
│       │   └── route.ts                     # NEW: PDF generation endpoint
│       └── export-preview/
│           └── [memberId]/
│               └── route.ts                 # NEW: Print preview HTML route
└── lib/
    ├── utils/
    │   ├── pdf-generator.ts                 # NEW: Puppeteer PDF utility
    │   └── report-data-fetcher.ts           # NEW: Server-side data fetching
    └── validations/
        └── report-export.ts                 # NEW: Export options schema
```

### 2. Export Options Schema

```typescript
// src/lib/validations/report-export.ts
import { z } from 'zod';

export const exportOptionsSchema = z.object({
  memberId: z.number().min(1, 'Member ID is required'),
  format: z.enum(['pdf', 'html']).default('pdf'),
  sections: z.object({
    memberProgress: z.boolean().default(true),
    msqAssessment: z.boolean().default(true),
    promisAssessment: z.boolean().default(true),
  }),
  dateRange: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  includeCharts: z.boolean().default(true),
  includeInterpretation: z.boolean().default(true),
  delivery: z.enum(['download', 'email']).default('download'),
  recipientEmail: z.string().email().optional(),
});

export type ExportOptions = z.infer<typeof exportOptionsSchema>;
```

### 3. PDF Generation Utility

```typescript
// src/lib/utils/pdf-generator.ts
import puppeteer from 'puppeteer';

export interface PdfGenerationOptions {
  html: string;
  filename: string;
  format?: 'A4' | 'Letter';
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
      top: '0.5in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in',
    },
  } = options;

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Set content with proper base URL for assets
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
    });

    // Wait for charts to render (Recharts uses RAF)
    await page.waitForTimeout(1000);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin,
      printBackground: true,
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
```

### 4. API Route: PDF Export

```typescript
// src/app/api/report-card/export-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { exportOptionsSchema } from '@/lib/validations/report-export';
import { generatePdfFromHtml } from '@/lib/utils/pdf-generator';
import { fetchReportCardData } from '@/lib/utils/report-data-fetcher';
import { renderPrintReport } from '@/lib/utils/render-print-report';

export async function POST(request: NextRequest) {
  try {
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

    // 2. Validate request body
    const body = await request.json();
    const options = exportOptionsSchema.parse(body);

    // 3. Fetch all report data server-side
    const reportData = await fetchReportCardData(
      supabase,
      options.memberId,
      options.sections,
      options.dateRange
    );

    // 4. Render print-optimized HTML
    const html = await renderPrintReport(reportData, options);

    // 5. Generate PDF using Puppeteer
    const pdfBuffer = await generatePdfFromHtml({
      html,
      filename: `report-card-${reportData.member.name}-${new Date().toISOString().split('T')[0]}.pdf`,
      format: 'Letter',
      margin: {
        top: '0.75in',
        right: '0.5in',
        bottom: '0.75in',
        left: '0.5in',
      },
    });

    // 6. Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Report-Card-${reportData.member.firstName}-${reportData.member.lastName}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Export PDF error:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid export options', details: error.message },
        { status: 400 }
      );
    }

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

### 5. Print-Optimized Component Example

```typescript
// src/components/report-card/print/PrintMemberProgress.tsx
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
      {/* Section Header */}
      <Typography variant="h5" sx={printStyles.sectionTitle}>
        Member Progress
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {/* Profile Information */}
      <Box sx={printStyles.subsection}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Member Profile
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="textSecondary">
              Name
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {data.first_name} {data.last_name}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="textSecondary">
              Program
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {data.program_template_name || 'N/A'}
            </Typography>
          </Grid>
          {/* More profile fields... */}
        </Grid>
      </Box>

      {/* Curriculum Progress */}
      <Box sx={{ ...printStyles.subsection, pageBreakInside: 'avoid' }}>
        <Typography variant="h6" sx={printStyles.subsectionTitle}>
          Curriculum Progress
        </Typography>
        {/* Render progress data in print-friendly format */}
      </Box>

      {/* Goals, Wins, Challenges in print-optimized layout */}
      {/* ... */}
    </Box>
  );
}
```

### 6. Print Styles

```typescript
// src/components/report-card/print/print-styles.ts
export const printStyles = {
  // Master page layout
  page: {
    width: '8.5in',
    minHeight: '11in',
    padding: '0.75in 0.5in',
    backgroundColor: '#ffffff',
    color: '#000000',
    '@media print': {
      margin: 0,
      padding: 0,
    },
  },

  // Section styles
  section: {
    marginBottom: '24px',
    pageBreakInside: 'avoid',
    '&:not(:last-child)': {
      pageBreakAfter: 'auto',
    },
  },

  sectionTitle: {
    fontWeight: 700,
    marginBottom: '16px',
    color: '#8e24ff', // Brand purple
    borderBottom: '2px solid #8e24ff',
    paddingBottom: '8px',
  },

  subsection: {
    marginBottom: '20px',
  },

  subsectionTitle: {
    fontWeight: 600,
    marginBottom: '12px',
    color: '#333333',
  },

  // Chart container
  chartContainer: {
    pageBreakInside: 'avoid',
    marginTop: '16px',
    marginBottom: '16px',
  },

  // Data table
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse',
    '& th': {
      backgroundColor: '#f5f5f5',
      padding: '8px',
      textAlign: 'left',
      fontWeight: 600,
      borderBottom: '2px solid #ddd',
    },
    '& td': {
      padding: '8px',
      borderBottom: '1px solid #eee',
    },
  },

  // Hide interactive elements
  noprint: {
    '@media print': {
      display: 'none !important',
    },
  },
};
```

### 7. Export Modal Component

```typescript
// src/components/report-card/ExportReportModal.tsx
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  TextField,
  CircularProgress,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { toast } from 'sonner';
import { ExportOptions } from '@/lib/validations/report-export';

interface ExportReportModalProps {
  open: boolean;
  onClose: () => void;
  memberId: number;
  memberName: string;
}

export default function ExportReportModal({
  open,
  onClose,
  memberId,
  memberName,
}: ExportReportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<Partial<ExportOptions>>({
    memberId,
    format: 'pdf',
    sections: {
      memberProgress: true,
      msqAssessment: true,
      promisAssessment: true,
    },
    includeCharts: true,
    includeInterpretation: true,
    delivery: 'download',
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const response = await fetch('/api/report-card/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportOptions),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Report-Card-${memberName.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Report exported successfully!');
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to export report'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Report Card</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="textSecondary">
            Exporting report for: <strong>{memberName}</strong>
          </Typography>
        </Box>

        {/* Sections to Include */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Sections to Include
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.sections?.memberProgress}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      sections: {
                        ...exportOptions.sections!,
                        memberProgress: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="Member Progress"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.sections?.msqAssessment}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      sections: {
                        ...exportOptions.sections!,
                        msqAssessment: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="MSQ Assessment"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.sections?.promisAssessment}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      sections: {
                        ...exportOptions.sections!,
                        promisAssessment: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="PROMIS-29 Assessment"
            />
          </FormGroup>
        </Box>

        {/* Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Options
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.includeCharts}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      includeCharts: e.target.checked,
                    })
                  }
                />
              }
              label="Include Charts and Visualizations"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.includeInterpretation}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      includeInterpretation: e.target.checked,
                    })
                  }
                />
              }
              label="Include Interpretation Guides"
            />
          </FormGroup>
        </Box>

        {/* Delivery Method */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Delivery
          </Typography>
          <RadioGroup
            value={exportOptions.delivery}
            onChange={(e) =>
              setExportOptions({
                ...exportOptions,
                delivery: e.target.value as 'download' | 'email',
              })
            }
          >
            <FormControlLabel
              value="download"
              control={<Radio />}
              label="Download to my computer"
            />
            <FormControlLabel
              value="email"
              control={<Radio />}
              label="Email to member"
              disabled // Phase 2 feature
            />
          </RadioGroup>
          {exportOptions.delivery === 'email' && (
            <TextField
              fullWidth
              size="small"
              label="Recipient Email"
              type="email"
              value={exportOptions.recipientEmail || ''}
              onChange={(e) =>
                setExportOptions({
                  ...exportOptions,
                  recipientEmail: e.target.value,
                })
              }
              sx={{ mt: 2 }}
            />
          )}
        </Box>

        {exportOptions.delivery === 'email' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Email delivery will be available in Phase 2
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={
            isExporting ||
            !Object.values(exportOptions.sections || {}).some((v) => v)
          }
          startIcon={isExporting && <CircularProgress size={16} />}
        >
          {isExporting ? 'Generating...' : 'Export PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 8. Integration with Report Card Page

```typescript
// Add to src/app/dashboard/report-card/page.tsx

// Add imports
import DownloadIcon from '@mui/icons-material/Download';
import ExportReportModal from '@/components/report-card/ExportReportModal';

// Add state
const [isExportModalOpen, setIsExportModalOpen] = useState(false);

// Add button to header (around line 140)
<Tooltip title="Export Report">
  <IconButton
    onClick={() => setIsExportModalOpen(true)}
    color="primary"
    disabled={!selectedMember}
  >
    <DownloadIcon />
  </IconButton>
</Tooltip>

// Add modal at bottom (before closing </Box>)
{selectedMember && (
  <ExportReportModal
    open={isExportModalOpen}
    onClose={() => setIsExportModalOpen(false)}
    memberId={selectedMember.lead_id}
    memberName={selectedMember.full_name}
  />
)}
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create print-optimized component structure
- [ ] Implement PDF generation utility with Puppeteer
- [ ] Create export API route
- [ ] Add export button and modal to Report Card page
- [ ] Test with Member Progress tab only

### Phase 2: Complete Integration (Week 2)
- [ ] Create print components for MSQ Assessment
- [ ] Create print components for PROMIS-29
- [ ] Implement server-side data fetching utility
- [ ] Add date range filtering
- [ ] Implement full export with all sections

### Phase 3: Polish & Enhancement (Week 3)
- [ ] Add cover page with branding
- [ ] Implement page headers/footers with page numbers
- [ ] Add email delivery option (integrate with existing email system)
- [ ] Implement export preview feature
- [ ] Add export history tracking
- [ ] Performance optimization (caching, parallel rendering)

### Phase 4: Advanced Features (Future)
- [ ] Batch export for multiple members
- [ ] Scheduled automated reports
- [ ] Custom report templates
- [ ] Export to other formats (DOCX, Excel)
- [ ] Print-friendly view directly in browser

## Technical Considerations

### Performance
- **Puppeteer overhead**: ~2-5 seconds per report
- **Mitigation**: Implement job queue for batch exports
- **Caching**: Cache rendered HTML for 5 minutes
- **Resource limits**: Monitor memory usage on server

### Security
- ✅ Authenticate all API requests
- ✅ Validate member access permissions (RLS)
- ✅ Sanitize user inputs
- ✅ Implement rate limiting on export endpoint
- ✅ Audit trail for report generation

### Scalability
- Use background job queue (e.g., Bull/BullMQ) for async processing
- Implement report generation queue with priority
- Monitor Puppeteer instances (limit concurrent browsers)
- Consider serverless deployment for PDF generation

### Quality Assurance
- Test with various data volumes
- Verify chart rendering accuracy
- Cross-browser testing (Chrome, Firefox, Safari)
- Print quality validation (300 DPI)
- Accessibility compliance (PDF/UA standard)

## Alternative Approaches Considered

### ❌ @react-pdf/renderer
**Pros:** Lightweight, no browser needed
**Cons:** Would require rewriting all UI components, poor chart support, steep learning curve

**Decision:** Rejected - Too much rework, inferior output quality

### ❌ Client-side html2canvas + jsPDF
**Pros:** No server changes needed
**Cons:** Poor quality, issues with MUI components, chart rendering problems

**Decision:** Rejected - Quality not suitable for clinical reports

### ❌ Continue DOCX pattern
**Pros:** Consistent with existing quote generation
**Cons:** Charts very difficult to embed, limited styling, complex table layouts

**Decision:** Rejected - Charts are essential, DOCX not ideal for this use case

## Success Metrics

### Technical Metrics
- PDF generation time: < 5 seconds for standard report
- PDF file size: < 5 MB typical
- Success rate: > 99% (with proper error handling)
- Server resource usage: < 500 MB memory per export

### Business Metrics
- User adoption: Track number of reports exported per week
- User satisfaction: Collect feedback on report quality
- Time savings: Measure reduction in manual report creation
- Member engagement: Track if shared reports increase member portal usage

## Cost & Resource Estimation

### Development Time
- Phase 1: 20 hours (Foundation)
- Phase 2: 24 hours (Complete Integration)
- Phase 3: 16 hours (Polish & Enhancement)
- **Total:** ~60 hours (1.5-2 weeks for 1 developer)

### Infrastructure Costs
- No new services required (Puppeteer already installed)
- Moderate increase in server memory usage (~100-200 MB per concurrent export)
- Storage: ~2-5 MB per generated report (if cached)

### Dependencies
- ✅ Puppeteer: Already installed
- ✅ Next.js API routes: Existing
- ✅ Supabase: Existing
- ✅ React Query: Existing
- New: None required

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Puppeteer performance issues | Medium | Medium | Implement queue system, add caching |
| Chart rendering failures | Low | High | Extensive testing, fallback to static images |
| Memory leaks from browser instances | Medium | High | Proper cleanup, monitoring, resource limits |
| Large file sizes | Low | Low | Optimize images, compress PDFs |
| Concurrent user load | Medium | Medium | Queue system, rate limiting |

## Conclusion

This solution leverages existing infrastructure (Puppeteer) and established patterns (server-side document generation) to create a robust, high-quality PDF export system. The phased approach allows for incremental delivery and testing, minimizing risk while providing immediate value.

**Recommendation:** Proceed with Phase 1 implementation, focusing on Member Progress tab export as proof of concept.

## Questions for Stakeholders

1. **Priority:** Which section should we implement first? (Recommendation: Member Progress)
2. **Branding:** Do we have specific branding guidelines for printed reports? (Logo, colors, fonts)
3. **Access Control:** Should all staff be able to export reports, or only certain roles?
4. **Email Delivery:** Is there an existing email service we should integrate with?
5. **Compliance:** Are there specific HIPAA or regulatory requirements for report generation?
6. **Storage:** Should we store generated reports, or generate on-demand only?
7. **Member Access:** Should members be able to generate their own reports from a member portal?



















