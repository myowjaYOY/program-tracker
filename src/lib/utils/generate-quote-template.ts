import docxmarks from 'docxmarks';
import createReport from 'docx-templates';
import { buildContractOptions } from './contract-options';

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
    totalTaxableCharge?: number; // optional, used for contract options
    // Raw data needed for contract options calculation
    totalCharge?: number; // base charge from items
    totalCost?: number; // cost of items
  };
  payments: {
    paymentId: number;
    amount: number;
    dueDate: string;
    paymentDate?: string;
  }[];
  generatedDate: string;
}

interface PlanSummaryData {
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
  therapyTypes: {
    name: string;
    items: {
      name: string;
      quantity: number;
      instructions: string;
    }[];
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

export async function downloadPlanSummaryFromTemplate(
  data: PlanSummaryData,
  templateBuffer: ArrayBuffer
): Promise<void> {
  return downloadPlanSummaryDocumentFromTemplate(data, templateBuffer, 'PS');
}

async function downloadDocumentFromTemplate(
  data: QuoteData,
  templateBuffer: ArrayBuffer,
  prefix: string
): Promise<void> {
  try {
    // Prepare bookmark replacements
    // Compute optional contract options using shared calculation functions
    const options = buildContractOptions({
      totalCharge: Number(data.financials.totalCharge || 0),
      totalCost: Number(data.financials.totalCost || 0),
      financeCharges: Number(data.financials.financeCharges || 0),
      discounts: Number(data.financials.discounts || 0),
      totalTaxableCharge: Number(data.financials.totalTaxableCharge || 0),
    });

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

      // New Contract Option Bookmarks
      'DISCOUNTED_PRETAX_5_AMOUNT': `$${options.discountedPreTax5Amount.toFixed(2)}`,
      'DISCOUNTED_PROGRAM_PRICE_5': `$${options.discountedProgramPrice5.toFixed(2)}`,
      'FINANCE_FULL_AMOUNT': `$${options.financeFullAmount.toFixed(2)}`,
      'FINANCE_DOWN_PAYMENT': `$${options.financeDownPayment.toFixed(2)}`,
      'FINANCE_MONTHLY_PAYMENT': `$${options.financeMonthlyPayment.toFixed(2)}`,
      'THREE_EQUAL_PAYMENTS': `$${options.threeEqualPayments.toFixed(2)}`,
      
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
    const updatedDocxBuffer = await docxmarks(buffer, replacements, 12);
    
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

async function downloadPlanSummaryDocumentFromTemplate(
  data: PlanSummaryData,
  templateBuffer: ArrayBuffer,
  prefix: string
): Promise<void> {
  try {
    // Prepare bookmark replacements for simple data
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
      
      // Generated Date
      'GENERATED_DATE': data.generatedDate,
    };

    // Convert ArrayBuffer to Buffer (for docxmarks)
    const buffer = Buffer.from(templateBuffer);
    
    // First pass: Replace bookmarks in template with font size option
    const updatedDocxBuffer = await docxmarks(buffer, replacements, 12);
    
    // Second pass: Render therapy types table using docx-templates
    const intermediateDoc = Buffer.from(updatedDocxBuffer);
    
    // Flatten the data structure for table rendering
    const flattenedData = {
      therapyTypes: data.therapyTypes.map(tt => ({
        name: tt.name,
        items: tt.items.map(item => ({
          name: item.name,
          quantity: item.quantity.toString(),
          instructions: item.instructions
        }))
      }))
    };
    
    const finalDocxBuffer = await createReport({
      template: intermediateDoc,
      data: flattenedData,
      cmdDelimiter: '+++',
      processLineBreaks: true,
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
    throw new Error(`Failed to generate plan summary document from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


