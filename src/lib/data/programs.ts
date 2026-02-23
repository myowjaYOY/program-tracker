import { createClient } from '@/lib/supabase/server';
import { MemberPrograms } from '@/types/database.types';

export async function getMemberPrograms(): Promise<MemberPrograms[]> {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase
            .from('member_programs')
            .select(`
        *,
        created_user:users!member_programs_created_by_fkey(id, email, full_name),
        updated_user:users!member_programs_updated_by_fkey(id, email, full_name),
        lead:leads!fk_member_programs_lead(lead_id, first_name, last_name, email),
        program_status:program_status!fk_member_programs_program_status(program_status_id, status_name),
        program_template:program_template!fk_member_programs_source_template(program_template_id, program_template_name),
        member_program_finances(member_program_finance_id, margin, finance_charges, taxes, discounts, final_total_price)
      `)
            .order('program_template_name');

        if (error) {
            console.error('Error fetching member programs:', error);
            return [];
        }

        // Map to flat fields for frontend (consistent with API pattern)
        return (data || []).map(program => {
            const financeRecord = program.member_program_finances?.[0] || null;

            return {
                ...program,
                created_by_email: program.created_user?.email || null,
                created_by_full_name: program.created_user?.full_name || null,
                updated_by_email: program.updated_user?.email || null,
                updated_by_full_name: program.updated_user?.full_name || null,
                lead_name: program.lead
                    ? `${program.lead.first_name} ${program.lead.last_name}`.trim()
                    : null,
                lead_email: program.lead?.email || null,
                template_name: program.program_template?.program_template_name || null,
                status_name: program.program_status?.status_name || null,
                margin: financeRecord?.margin ?? null,
                final_total_price: financeRecord?.final_total_price ?? null,
            };
        }) as any[];
    } catch (error) {
        console.error('Error in getMemberPrograms:', error);
        return [];
    }
}
