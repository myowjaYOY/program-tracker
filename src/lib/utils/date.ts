/**
 * Centralized date/time formatting utilities.
 *
 * All timestamps from Supabase are stored as UTC (timestamptz).
 * These functions ensure values are always parsed as UTC and
 * displayed in the user's local browser timezone.
 */

function ensureUtc(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/[Zz]$/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value)) return value;
  return value + 'Z';
}

/**
 * Format a date-only display (no time). Handles YYYY-MM-DD strings
 * without UTC shift, and full timestamps in the user's timezone.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const local = new Date(y ?? 2024, (m ?? 1) - 1, d ?? 1);
    return local.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return new Date(ensureUtc(value)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a full date + time display in the user's local timezone.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';

  return new Date(ensureUtc(value)).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
