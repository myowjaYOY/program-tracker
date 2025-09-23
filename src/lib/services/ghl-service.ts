import { createClient } from '@/lib/supabase/server';
import { leadSchema } from '@/lib/validations/lead';
import { ghlConfig, TRIGGER_STAGES } from '@/lib/config/ghl';
import { shouldCreateLead } from '@/lib/utils/ghl-webhook';

export interface GHLContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactId: string;
  locationId: string;
  stage: string;
  pipeline: string;
}

export class GHLService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a lead from GHL contact data
   */
  async createLeadFromGHL(
    contact: GHLContact
  ): Promise<{ success: boolean; leadId?: number; error?: string }> {
    try {
      // Check if lead already exists
      const { data: existingLead } = await this.supabase
        .from('leads')
        .select('lead_id')
        .eq('email', contact.email)
        .single();

      if (existingLead) {
        return {
          success: false,
          error: `Lead with email ${contact.email} already exists`,
        };
      }

      // Get default status and campaign
      const { data: defaultStatus } = await this.supabase
        .from('lead_status')
        .select('status_id')
        .eq('status_name', ghlConfig.defaultStatusName)
        .single();

      const { data: defaultCampaign } = await this.supabase
        .from('campaigns')
        .select('campaign_id')
        .eq('campaign_name', ghlConfig.defaultCampaignName)
        .single();

      // Prepare lead data
      const leadData = {
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        status_id: defaultStatus?.status_id || 1,
        campaign_id: defaultCampaign?.campaign_id || 1,
        pmedate: null,
        active_flag: true,
        created_by: 'ghl-webhook',
        updated_by: 'ghl-webhook',
      };

      // Validate the data
      const validatedData = leadSchema.parse(leadData);

      // Insert the lead
      const { data: newLead, error } = await this.supabase
        .from('leads')
        .insert(validatedData)
        .select()
        .single();

      if (error) {
        console.error('Error creating lead:', error);
        return {
          success: false,
          error: `Failed to create lead: ${error.message}`,
        };
      }

      return {
        success: true,
        leadId: newLead.lead_id,
      };
    } catch (error) {
      console.error('GHL service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a stage should trigger lead creation
   */
  shouldTriggerLeadCreation(stageName: string): boolean {
    return shouldCreateLead(stageName, TRIGGER_STAGES);
  }

  /**
   * Get or create default campaign for GHL imports
   */
  async ensureDefaultCampaign(): Promise<number> {
    const { data: existingCampaign } = await this.supabase
      .from('campaigns')
      .select('campaign_id')
      .eq('campaign_name', ghlConfig.defaultCampaignName)
      .single();

    if (existingCampaign) {
      return existingCampaign.campaign_id;
    }

    // Create default campaign if it doesn't exist
    const { data: newCampaign, error } = await this.supabase
      .from('campaigns')
      .insert({
        campaign_name: ghlConfig.defaultCampaignName,
        description: 'Automatically created for GHL webhook imports',
        active_flag: true,
        created_by: 'ghl-service',
        updated_by: 'ghl-service',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating default campaign:', error);
      return 1; // Fallback to campaign_id 1
    }

    return newCampaign.campaign_id;
  }

  /**
   * Get or create default status for GHL imports
   */
  async ensureDefaultStatus(): Promise<number> {
    const { data: existingStatus } = await this.supabase
      .from('lead_status')
      .select('status_id')
      .eq('status_name', ghlConfig.defaultStatusName)
      .single();

    if (existingStatus) {
      return existingStatus.status_id;
    }

    // Create default status if it doesn't exist
    const { data: newStatus, error } = await this.supabase
      .from('lead_status')
      .insert({
        status_name: ghlConfig.defaultStatusName,
        description: 'Automatically created for GHL webhook imports',
        active_flag: true,
        created_by: 'ghl-service',
        updated_by: 'ghl-service',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating default status:', error);
      return 1; // Fallback to status_id 1
    }

    return newStatus.status_id;
  }
}
