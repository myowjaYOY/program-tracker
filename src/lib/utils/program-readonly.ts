/**
 * Utility to determine if a program is in a final/read-only state
 */

export function isProgramReadOnly(statusName: string | null | undefined): boolean {
  if (!statusName) return false;
  
  const status = statusName.toLowerCase();
  return status === 'completed' || status === 'cancelled' || status === 'lost';
}

export function getReadOnlyMessage(statusName: string | null | undefined): string {
  if (!statusName) return '';
  
  const status = statusName.toLowerCase();
  if (status === 'completed') {
    return 'This program is Completed and cannot be modified.';
  }
  if (status === 'cancelled') {
    return 'This program is Cancelled and cannot be modified.';
  }
  if (status === 'lost') {
    return 'This program is Lost and cannot be modified.';
  }
  return '';
}

