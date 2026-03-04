/**
 * Lead status transition rules.
 * Maps each status to the status names that are valid next states when editing a lead.
 */
/** Status names that can be chosen when adding a new lead. Discovery Scheduled is only available here. */
export const CREATE_MODE_STATUS_NAMES = ['Confirmed', 'Discovery Scheduled'];

export const LEAD_STATUS_TRANSITIONS: Record<string, string[]> = {
  Confirmed: ['No Show', 'No PME', 'PME Scheduled'],
  'Discovery Scheduled': ['No Show', 'Lost', 'PME Scheduled'],
  'No Show': ['Confirmed'],
  'No PME': ['PME Scheduled'],
  'PME Scheduled': ['Lost', 'Won', 'Follow Up', 'No Program'],
  Lost: ['PME Scheduled'],
  'Follow Up': ['Won', 'No Program', 'Lost'],
  'No Program': ['PME Scheduled'],
  Won: [], // Terminal - no transitions away
};

/**
 * Returns the list of status names that are valid for selection when the lead's
 * current status is currentStatusName. Includes the current status so it can be kept.
 */
export function getAllowedStatusNames(currentStatusName: string): string[] {
  const allowedNext = LEAD_STATUS_TRANSITIONS[currentStatusName];
  if (allowedNext === undefined) {
    return [currentStatusName]; // Unknown status: only allow keeping current
  }
  return [currentStatusName, ...allowedNext];
}
