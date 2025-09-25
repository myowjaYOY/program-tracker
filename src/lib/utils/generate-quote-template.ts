import docxmarks from 'docxmarks';

interface QuoteData {
  member: {
    name: string;
    email: string;
    phone: string;
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
      
      // Payment Schedule
      'PAYMENT_SCHEDULE': formatPaymentSchedule(data.payments),
      
      // Generated Date
      'GENERATED_DATE': data.generatedDate,
      
      // Summary Information
      'TOTAL_PAYMENTS': data.payments.length.toString(),
      'PAID_PAYMENTS': data.payments.filter(p => p.paymentDate).length.toString(),
      'PENDING_PAYMENTS': data.payments.filter(p => !p.paymentDate).length.toString(),
    };


    // Convert ArrayBuffer to Buffer (for docxmarks)
    const buffer = Buffer.from(templateBuffer);
    
    // Replace bookmarks in template with font size option
    const updatedDocxBuffer = await docxmarks(buffer, replacements, 11);
    
    // Create filename by removing special characters
    const memberName = data.member.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const programName = data.program.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const filename = `${memberName} - ${programName}.docx`;
    
    // Create blob and trigger download
    const blob = new Blob([new Uint8Array(updatedDocxBuffer)], {
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

function formatPaymentSchedule(payments: QuoteData['payments']): string {
  if (!payments || payments.length === 0) {
    return 'No payment schedule available.';
  }

  const paymentRows = payments.map((payment, index) => {
    const status = payment.paymentDate ? 'Paid' : 'Pending';
    const statusIcon = payment.paymentDate ? '✓' : '○';
    return `${index + 1}. ${statusIcon} $${payment.amount.toFixed(2)} - Due: ${payment.dueDate} (${status})`;
  }).join('\n');

  return `Payment Schedule:\n${paymentRows}`;
}

// Alternative: Generate a simple table format for the payment schedule
function formatPaymentScheduleTable(payments: QuoteData['payments']): string {
  if (!payments || payments.length === 0) {
    return 'No payment schedule available.';
  }

  const header = 'Payment #\tAmount\t\tDue Date\t\tStatus';
  const separator = '─────────\t──────\t\t────────\t\t──────';
  const rows = payments.map((payment, index) => {
    const status = payment.paymentDate ? 'Paid' : 'Pending';
    return `${index + 1}\t\t$${payment.amount.toFixed(2)}\t\t${payment.dueDate}\t\t${status}`;
  }).join('\n');

  return `${header}\n${separator}\n${rows}`;
}

