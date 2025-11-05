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
        '--disable-web-security',
      ],
    });

    page = await browser.newPage();

    console.log('📄 Setting HTML content...');
    console.log(`   HTML size: ${html.length} bytes`);
    
    // Set content with proper base URL for assets
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000,
    });

    console.log('⏳ Waiting for dynamic content...');
    
    // Debug: Check if content is visible
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`   Body text length: ${bodyText.length} characters`);
    if (bodyText.length < 50) {
      console.warn('⚠️ Warning: Very little text detected in page body!');
      console.log('   First 200 chars of body:', bodyText.substring(0, 200));
    }
    
    // Wait for any dynamic content to render (using Promise-based delay)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Optionally wait for specific elements
    try {
      await page.waitForSelector('[data-print-ready="true"]', { timeout: 5000 });
    } catch {
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
      displayHeaderFooter: false,
    });

    console.log('✅ PDF generated successfully!');
    
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Card</title>
  <style>
    /* Base styles */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }

    /* Ensure all elements are visible */
    div, p, h1, h2, h3, h4, h5, h6 {
      display: block;
    }

    /* Print media styles */
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
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
</html>`;
}

