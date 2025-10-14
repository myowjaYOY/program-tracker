import { ItemRequest } from '@/types/database.types';

/**
 * Derives the status of an item request based on date fields and cancellation flag
 */
export function deriveStatus(
  request: Partial<ItemRequest>
): 'Pending' | 'Ordered' | 'Received' | 'Cancelled' {
  if (request.is_cancelled) {
    return 'Cancelled';
  }
  if (request.received_date) {
    return 'Received';
  }
  if (request.ordered_date) {
    return 'Ordered';
  }
  return 'Pending';
}

/**
 * Gets the sort order for a status (lower number = higher priority)
 */
export function getStatusOrder(
  status: 'Pending' | 'Ordered' | 'Received' | 'Cancelled'
): number {
  switch (status) {
    case 'Pending':
      return 1;
    case 'Ordered':
      return 2;
    case 'Received':
      return 3;
    case 'Cancelled':
      return 4;
    default:
      return 999;
  }
}

/**
 * Gets the MUI color for a status chip
 */
export function getStatusColor(
  status: 'Pending' | 'Ordered' | 'Received' | 'Cancelled'
):
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning' {
  switch (status) {
    case 'Pending':
      return 'warning'; // Orange
    case 'Ordered':
      return 'info'; // Blue
    case 'Received':
      return 'success'; // Green
    case 'Cancelled':
      return 'error'; // Red
    default:
      return 'default';
  }
}

/**
 * Checks if an item request is late (ordered more than 7 days ago without being received)
 */
export function isItemRequestLate(request: Partial<ItemRequest>): boolean {
  if (!request.ordered_date || request.received_date || request.is_cancelled) {
    return false;
  }

  const orderedDate = new Date(request.ordered_date);
  const today = new Date();
  const daysDiff = Math.floor(
    (today.getTime() - orderedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysDiff > 7;
}

/**
 * Gets a user-friendly display name from request user fields
 */
export function getUserDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  if (fullName && fullName.trim()) {
    return fullName;
  }
  if (email) {
    return email;
  }
  return '-';
}



