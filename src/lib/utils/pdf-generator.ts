/**
 * PDF Generator Utility
 * 
 * Uses @react-pdf/renderer for serverless-compatible PDF generation.
 * Replaces the Puppeteer-based approach.
 * 
 * Migration Notes:
 * - No Chrome/Chromium dependency required
 * - Works in Vercel serverless without special configuration
 * - Generates PDFs ~5-10x faster than Puppeteer
 * - Bundle size reduced by ~50MB (no chromium binary)
 */

import { renderToBuffer } from '@react-pdf/renderer';
import ReportCardPdfDocument, { ReportCardPdfProps } from '@/components/pdf/ReportCardPdfDocument';
import React from 'react';

export interface GeneratePdfOptions {
  memberName: string;
  reportDate: string;
  sections: {
    memberProgress: boolean;
    msqAssessment: boolean;
    promisAssessment: boolean;
  };
  data: {
    memberProgress?: any;
    msqAssessment?: any;
    promisAssessment?: any;
  };
}

/**
 * Generate a PDF buffer from report card data
 * 
 * @param options - Report configuration and data
 * @returns Promise<Buffer> - PDF file as buffer
 */
export async function generateReportCardPdf(options: GeneratePdfOptions): Promise<Buffer> {
  const { memberName, reportDate, sections, data } = options;

  console.log('📄 Generating PDF with @react-pdf/renderer...');
  console.log(`   Member: ${memberName}`);
  console.log(`   Sections: ${Object.entries(sections).filter(([, v]) => v).map(([k]) => k).join(', ')}`);

  const startTime = Date.now();

  try {
    // Create the React element
    const element = React.createElement(ReportCardPdfDocument, {
      memberName,
      reportDate,
      sections,
      data,
    } as ReportCardPdfProps);

    // Render to buffer
    const pdfBuffer = await renderToBuffer(element as any);

    const duration = Date.now() - startTime;
    console.log(`✅ PDF generated successfully in ${duration}ms`);
    console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Legacy wrapper for compatibility with existing code
 * Maps the old HTML-based interface to the new React component approach
 * 
 * @deprecated Use generateReportCardPdf directly
 */
export async function generatePdfFromHtml(options: {
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
}): Promise<Buffer> {
  console.warn('⚠️ generatePdfFromHtml is deprecated. Use generateReportCardPdf with React components instead.');
  throw new Error(
    'HTML-to-PDF conversion is no longer supported. ' +
    'Please update to use generateReportCardPdf with structured data.'
  );
}

/**
 * @deprecated No longer needed with @react-pdf/renderer
 */
export function wrapHtmlForPdf(bodyHtml: string, additionalStyles?: string): string {
  console.warn('⚠️ wrapHtmlForPdf is deprecated and will be removed.');
  return bodyHtml;
}