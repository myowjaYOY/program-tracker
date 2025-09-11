import crypto from 'crypto';

/**
 * Verify GHL webhook signature
 * @param payload - The raw request body
 * @param signature - The signature from the x-ghl-signature header
 * @param secret - Your GHL webhook secret
 * @returns boolean indicating if the signature is valid
 */
export function verifyGHLWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying GHL webhook signature:', error);
    return false;
  }
}

/**
 * Extract contact information from GHL webhook payload
 */
export function extractContactInfo(payload: any) {
  const contact = payload.contact || {};
  
  return {
    firstName: contact.firstName || contact.first_name || '',
    lastName: contact.lastName || contact.last_name || '',
    email: contact.email || '',
    phone: contact.phone || contact.phoneNumber || '',
    contactId: contact.id || payload.contactId || '',
    locationId: payload.locationId || '',
    stage: payload.stage?.name || '',
    pipeline: payload.pipeline?.name || '',
  };
}

/**
 * Check if the stage name should trigger lead creation
 */
export function shouldCreateLead(stageName: string, triggerStages: string[]): boolean {
  if (!stageName) return false;
  
  const normalizedStage = stageName.toLowerCase().trim();
  return triggerStages.some(trigger => 
    normalizedStage.includes(trigger.toLowerCase())
  );
}



