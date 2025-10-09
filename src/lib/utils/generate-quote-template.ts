import docxmarks from 'docxmarks';
import createReport from 'docx-templates';

interface QuoteData {
  member: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  program: {
    name: string;
    description: string;
    startDate: string;
    duration?: string;
  };
  financials: {
    financeCharges: number;
    taxes: number;
    discounts: number;
    finalTotalPrice: number;
    margin: number;
  };
  payments: {
    paymentId: number;
    amount: number;
    dueDate: string;
    paymentDate?: string;
  }[];
  generatedDate: string;
}

export async function downloadQuoteFromTemplate(
  data: QuoteData,
  templateBuffer: ArrayBuffer
): Promise<void> {
  return downloadDocumentFromTemplate(data, templateBuffer, 'Q');
}

export async function downloadContractFromTemplate(
  data: QuoteData,
  templateBuffer: ArrayBuffer
): Promise<void> {
  return downloadDocumentFromTemplate(data, templateBuffer, 'C');
}

async function downloadDocumentFromTemplate(
  data: QuoteData,
  templateBuffer: ArrayBuffer,
  prefix: string
): Promise<void> {
  try {
    // Prepare bookmark replacements
    const replacements: Record<string, string> = {
      // Member Information
      'MEMBER_NAME': data.member.name || 'N/A',
      'MEMBER_EMAIL': data.member.email || 'N/A',
      'MEMBER_PHONE': data.member.phone || 'N/A',
      'MEMBER_ADDRESS': data.member.address || 'N/A',
      
      // Program Information
      'PROGRAM_NAME': data.program.name || 'N/A',
      'PROGRAM_DESCRIPTION': data.program.description || 'N/A',
      'PROGRAM_START_DATE': data.program.startDate || 'N/A',
      'PROGRAM_DURATION': data.program.duration || 'N/A',
      
      // Financial Information
      'FINANCE_CHARGES': `$${data.financials.financeCharges.toFixed(2)}`,
      'TAXES': `$${data.financials.taxes.toFixed(2)}`,
      'DISCOUNTS': `$${data.financials.discounts.toFixed(2)}`,
      'FINAL_TOTAL_PRICE': `$${data.financials.finalTotalPrice.toFixed(2)}`,
      'MARGIN': `${data.financials.margin.toFixed(2)}%`,
      
      // Payment Schedule - will be handled separately as Word elements
      
      // Generated Date
      'GENERATED_DATE': data.generatedDate,
      
      // Summary Information
      'TOTAL_PAYMENTS': data.payments.length.toString(),
      'PAID_PAYMENTS': data.payments.filter(p => p.paymentDate).length.toString(),
      'PENDING_PAYMENTS': data.payments.filter(p => !p.paymentDate).length.toString(),
    };


    // Convert ArrayBuffer to Buffer (for docxmarks)
    const buffer = Buffer.from(templateBuffer);
    
    // First pass: Replace bookmarks in template with font size option
    const updatedDocxBuffer = await docxmarks(buffer, replacements, 11);
    
    // Second pass: Render payments table loop using docx-templates
    const intermediateDoc = Buffer.from(updatedDocxBuffer);
    
    // Pre-format payment amounts as currency strings
    const formattedPayments = data.payments.map(payment => ({
      paymentId: payment.paymentId,
      amount: `$${payment.amount.toFixed(2)}`,
      dueDate: payment.dueDate,
      paymentDate: payment.paymentDate,
    }));
    
    const finalDocxBuffer = await createReport({
      template: intermediateDoc,
      data: { payments: formattedPayments },
      cmdDelimiter: '+++', // matches your template syntax
    });
    
    // Create filename by removing special characters
    const memberName = data.member.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const programName = data.program.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const filename = `${prefix}-${memberName} - ${programName}.docx`;
    
    // Create blob and trigger download
    const blob = new Blob([new Uint8Array(finalDocxBuffer)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(`Failed to generate document from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


