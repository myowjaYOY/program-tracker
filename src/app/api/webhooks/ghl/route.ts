import { NextRequest, NextResponse } from 'next/server';
import { GHLService } from '@/lib/services/ghl-service';
import {
  extractContactInfo,
  verifyGHLWebhookSignature,
} from '@/lib/utils/ghl-webhook';
import { ghlConfig } from '@/lib/config/ghl';

// GHL webhook payload interface
interface GHLWebhookPayload {
  type: string;
  locationId: string;
  contactId: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    // Add other GHL contact fields as needed
  };
  pipeline?: {
    id: string;
    name: string;
  };
  stage?: {
    id: string;
    name: string;
  };
  // Add other GHL webhook fields as needed
}

export async function POST(request: NextRequest) {
  try {
    const ghlService = new GHLService();

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature (REQUIRED for security)
    const signature = request.headers.get('x-ghl-signature');
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET;

    // Require signature verification if webhook secret is configured
    if (!webhookSecret) {
      console.error('GHL_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not properly configured' },
        { status: 500 }
      );
    }

    if (!signature) {
      console.log('Missing webhook signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    const isValid = verifyGHLWebhookSignature(
      rawBody,
      signature,
      webhookSecret
    );
    
    if (!isValid) {
      console.log('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload: GHLWebhookPayload = JSON.parse(rawBody);

    console.log('GHL Webhook received:', {
      type: payload.type,
      contactId: payload.contactId,
      stage: payload.stage?.name,
    });

    // Only process when contact reaches a trigger stage
    if (payload.type === 'ContactStageUpdate' && payload.stage?.name) {
      const stageName = payload.stage.name;

      if (ghlService.shouldTriggerLeadCreation(stageName)) {
        const contactInfo = extractContactInfo(payload);

        // Validate required fields
        if (
          !contactInfo.firstName ||
          !contactInfo.lastName ||
          !contactInfo.email ||
          !contactInfo.phone
        ) {
          console.log('Missing required contact fields:', contactInfo);
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        // Create the lead
        const result = await ghlService.createLeadFromGHL(contactInfo);

        if (result.success) {
          console.log('Lead created successfully:', result.leadId);
          return NextResponse.json(
            {
              message: 'Lead created successfully',
              leadId: result.leadId,
            },
            { status: 201 }
          );
        } else {
          console.log('Failed to create lead:', result.error);
          return NextResponse.json(
            {
              error: result.error || 'Failed to create lead',
            },
            { status: 400 }
          );
        }
      }
    }

    // For other webhook types or non-trigger stages, just acknowledge receipt
    return NextResponse.json({ message: 'Webhook received' }, { status: 200 });
  } catch (error) {
    console.error('GHL webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle GET requests (for webhook verification)
export async function GET() {
  return NextResponse.json(
    { message: 'GHL webhook endpoint is active' },
    { status: 200 }
  );
}
