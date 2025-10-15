import { MemberPrograms, MemberProgramItems } from '@/types/database.types';
import { downloadPlanSummaryFromTemplate } from './generate-quote-template';
import { loadTemplate, TEMPLATE_PATHS } from './template-loader';

/**
 * Generate Plan Summary document for a program
 * Reusable function that can be called from any component
 */
export async function generatePlanSummary(
  program: MemberPrograms,
  programItems: MemberProgramItems[]
): Promise<void> {
  // Group program items by therapy type
  const groupedByTherapyType: { [key: string]: any[] } = {};
  
  (programItems || []).forEach((item: any) => {
    const therapyTypeName = item.therapies?.therapytype?.therapy_type_name || 'Other';
    // Skip items with 'Other' therapy type
    if (therapyTypeName === 'Other') {
      return;
    }
    if (!groupedByTherapyType[therapyTypeName]) {
      groupedByTherapyType[therapyTypeName] = [];
    }
    groupedByTherapyType[therapyTypeName].push(item);
  });

  const therapyTypes = Object.entries(groupedByTherapyType)
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB)) // Sort therapy types by name
    .map(([therapyTypeName, items]) => ({
      name: therapyTypeName,
      items: items
        .map(item => ({
          name: item.therapies?.therapy_name || 'Unknown Item',
          quantity: item.quantity || 1,
          instructions: item.instructions || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)), // Sort items by name
    }));

  const planSummaryData = {
    member: {
      name: program.lead_name || 'N/A',
      email: program.lead_email || 'N/A',
      phone: 'N/A',
      address: 'N/A',
    },
    program: {
      name: program.program_template_name || 'Program',
      description: program.description || 'No description available',
      startDate: program.start_date ? new Date(program.start_date).toLocaleDateString() : 'Not set',
      duration: 'Program duration not specified',
    },
    therapyTypes,
    generatedDate: new Date().toLocaleDateString(),
  };

  const templateBuffer = await loadTemplate(TEMPLATE_PATHS.PLAN_SUMMARY);
  await downloadPlanSummaryFromTemplate(planSummaryData as any, templateBuffer);
}

