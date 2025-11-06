import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

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
    
    // Detect if we're in production (serverless) or local development
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    
    // Get executable path
    let executablePath: string;
    
    if (isProduction) {
      // Production: Use serverless chromium (packed GitHub release)
      console.log('📦 Using serverless Chromium for production...');
      executablePath = await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v141.0.0/chromium-v141.0.0-pack.x64.tar'
      );
    } else {
      // Local: Use system Chrome/Chromium/Edge
      console.log('💻 Using local Chrome/Edge for development...');
      // Puppeteer-core doesn't bundle Chrome, so we need to point to system Chrome or Edge
      // Common paths for different OS
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows Chrome
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows Chrome 32-bit
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', // Windows Edge
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', // Windows Edge 64-bit
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome', // Linux
        '/usr/bin/chromium-browser', // Linux alternative
      ];
      
      let localPath: string | undefined;
      
      // Try to find Chrome on the system
      const fs = await import('fs');
      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          localPath = path;
          console.log(`   Found Chrome at: ${path}`);
          break;
        }
      }
      
      if (!localPath) {
        console.warn('⚠️ Chrome not found on system. Install Chrome or set CHROME_PATH environment variable.');
        // Fallback: Try to use environment variable if set
        localPath = process.env.CHROME_PATH;
      }
      
      if (!localPath) {
        throw new Error('Chrome executable not found. Please install Chrome or set CHROME_PATH environment variable.');
      }
      
      executablePath = localPath;
    }
    
    // Launch headless browser
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      defaultViewport: { width: 1280, height: 720 },
      args: isProduction
        ? chromium.args
        : [
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

