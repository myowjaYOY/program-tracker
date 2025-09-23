// GoHighLevel (GHL) Integration Configuration

export interface GHLConfig {
  webhookUrl: string;
  apiKey?: string;
  locationId?: string;
  confirmedStageName: string;
  defaultStatusName: string;
  defaultCampaignName: string;
}

export const ghlConfig: GHLConfig = {
  webhookUrl: process.env.GHL_WEBHOOK_URL || '',
  apiKey: process.env.GHL_API_KEY || '',
  locationId: process.env.GHL_LOCATION_ID || '',
  confirmedStageName: process.env.GHL_CONFIRMED_STAGE_NAME || 'confirmed',
  defaultStatusName: process.env.GHL_DEFAULT_STATUS_NAME || 'New',
  defaultCampaignName: process.env.GHL_DEFAULT_CAMPAIGN_NAME || 'GHL Import',
};

// GHL API endpoints
export const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Webhook event types we're interested in
export const GHL_WEBHOOK_EVENTS = {
  CONTACT_STAGE_UPDATE: 'ContactStageUpdate',
  CONTACT_CREATED: 'ContactCreated',
  CONTACT_UPDATED: 'ContactUpdated',
} as const;

// Stage names that trigger lead creation
export const TRIGGER_STAGES = [
  'confirmed',
  'qualified',
  'ready to book',
  'appointment scheduled',
] as const;
