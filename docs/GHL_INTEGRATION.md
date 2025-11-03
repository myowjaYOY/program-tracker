# GoHighLevel (GHL) Integration Setup

This document explains how to set up automatic lead creation when contacts reach the "confirmed" stage in GoHighLevel.

## Overview

The integration automatically creates leads in your Program Tracker when GHL contacts reach specific stages (like "confirmed", "qualified", etc.). This is achieved through webhooks that GHL sends to your application.

## Setup Instructions

### 1. Environment Variables

Add these environment variables to your `.env.local` file:

```env
# GHL Webhook Configuration
GHL_WEBHOOK_SECRET=your_webhook_secret_here
GHL_WEBHOOK_URL=https://yourdomain.com/api/webhooks/ghl

# GHL API Configuration (optional, for future features)
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_location_id

# Default values for imported leads
GHL_CONFIRMED_STAGE_NAME=confirmed
GHL_DEFAULT_STATUS_NAME=New
GHL_DEFAULT_CAMPAIGN_NAME=GHL Import
```

### 2. GoHighLevel Webhook Setup (Using Workflows)

1. **Log into your GoHighLevel account**
2. **Navigate to Workflows** (not Integrations - webhooks are configured in Workflows)
3. **Create a new workflow:**
   - Click "Create Workflow" or "Add Workflow"
   - Give it a name like "Create Lead in Program Tracker"
4. **Add a Trigger:**
   - Click "Add Trigger"
   - Select **"Contact Stage Changed"** or **"Contact Stage Updated"**
   - Optionally, filter by specific stages (e.g., "confirmed", "qualified", "ready to book", "appointment scheduled")
5. **Add a Webhook Action:**
   - Click "Add Action"
   - Select **"Webhook"** or **"Outbound Webhook"**
   - Configure the webhook:
     - **Method**: POST
     - **URL**: `https://yourdomain.com/api/webhooks/ghl`
     - **Headers**: **REQUIRED** - Add custom header for security:
       - Header Name: `x-ghl-signature`
       - Header Value: Use GHL's custom value to compute HMAC-SHA256 signature of the payload with your secret
       - (Note: If GHL doesn't support automatic signature generation, you'll need to use a shared secret token instead)
     - **Payload**: Configure the webhook to send contact data. The payload should include:
       ```json
       {
         "type": "ContactStageUpdate",
         "locationId": "{{location.id}}",
         "contactId": "{{contact.id}}",
         "contact": {
           "id": "{{contact.id}}",
           "firstName": "{{contact.firstName}}",
           "lastName": "{{contact.lastName}}",
           "email": "{{contact.email}}",
           "phone": "{{contact.phone}}"
         },
         "stage": {
           "id": "{{stage.id}}",
           "name": "{{stage.name}}"
         }
       }
       ```
6. **Activate the workflow** and test it with a contact stage change

### 3. Database Setup

The integration will automatically create default status and campaign records if they don't exist:

- **Default Status**: "New" (or whatever you set in `GHL_DEFAULT_STATUS_NAME`)
- **Default Campaign**: "GHL Import" (or whatever you set in `GHL_DEFAULT_CAMPAIGN_NAME`)

### 4. Trigger Stages

The integration will create leads when contacts reach any of these stages:

- `confirmed`
- `qualified`
- `ready to book`
- `appointment scheduled`

You can modify these in `src/lib/config/ghl.ts` if needed.

## How It Works

1. **Contact reaches trigger stage** in GHL
2. **GHL sends webhook** to your application
3. **Webhook is verified** using the signature
4. **Contact data is extracted** and validated
5. **Lead is created** in your database with:
   - Contact's first name, last name, email, phone
   - Default status and campaign
   - `created_by` and `updated_by` set to "ghl-webhook"

## Testing

### Test the Webhook Endpoint

```bash
curl -X GET https://yourdomain.com/api/webhooks/ghl
```

Should return: `{"message": "GHL webhook endpoint is active"}`

### Test with Sample Data

```bash
curl -X POST https://yourdomain.com/api/webhooks/ghl \
  -H "Content-Type: application/json" \
  -H "x-ghl-signature: your_signature_here" \
  -d '{
    "type": "ContactStageUpdate",
    "locationId": "test-location",
    "contactId": "test-contact",
    "contact": {
      "id": "test-contact",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "555-123-4567"
    },
    "stage": {
      "id": "confirmed-stage",
      "name": "confirmed"
    }
  }'
```

## Troubleshooting

### Common Issues

1. **Webhook not triggering**: Check that the stage name matches exactly (case-insensitive)
2. **Duplicate leads**: The system checks for existing leads by email address
3. **Missing fields**: Ensure the contact has first name, last name, email, and phone
4. **Signature verification fails**: Check that `GHL_WEBHOOK_SECRET` matches in both places

### Logs

Check your application logs for webhook activity:

- Successful lead creation: `Lead created successfully: {leadId}`
- Duplicate leads: `Lead with email {email} already exists`
- Missing fields: `Missing required contact fields: {contactInfo}`

## Customization

### Adding New Trigger Stages

Edit `src/lib/config/ghl.ts`:

```typescript
export const TRIGGER_STAGES = [
  'confirmed',
  'qualified',
  'ready to book',
  'appointment scheduled',
  'your-new-stage', // Add your custom stage here
] as const;
```

### Changing Default Values

Update the environment variables:

- `GHL_DEFAULT_STATUS_NAME`: Change the default status for imported leads
- `GHL_DEFAULT_CAMPAIGN_NAME`: Change the default campaign for imported leads

### Custom Lead Processing

Modify `src/lib/services/ghl-service.ts` to add custom logic:

- Additional field mapping
- Custom validation rules
- Integration with other systems

## Security

- **Webhook signatures** are verified to ensure requests come from GHL
- **Input validation** prevents malformed data from being processed
- **Duplicate prevention** avoids creating multiple leads for the same contact
- **Error handling** ensures the system remains stable even with bad data

## Support

If you encounter issues:

1. Check the application logs for error messages
2. Verify your environment variables are set correctly
3. Test the webhook endpoint manually
4. Ensure your GHL webhook configuration matches the setup instructions
