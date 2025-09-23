import { MemberPrograms, MemberProgramPayments } from '@/types/database.types';

export interface ProgramLockInfo {
  locked: boolean;
  isLockedByStatus: boolean;
  hasPaidPayment: boolean;
}

/**
 * A single source of truth for determining whether Financials/Items should be locked.
 * Rules:
 * - Lock when program status is not "Quote" (case-insensitive)
 * - Lock when there is at least one payment with a Paid Date
 */
export function isProgramLocked(
  program: Partial<MemberPrograms> | null | undefined,
  payments: Partial<MemberProgramPayments>[] | null | undefined
): ProgramLockInfo {
  const statusName = (program as any)?.status_name as string | undefined;
  const statusId = (program as any)?.program_status_id as number | undefined;
  const isLockedByStatus = statusName
    ? statusName.toLowerCase() !== 'quote'
    : statusId !== undefined && statusId !== null; // conservative fallback

  const hasPaidPayment = Array.isArray(payments)
    ? payments.some(p => !!(p as any)?.payment_date)
    : false;

  return {
    locked: isLockedByStatus || hasPaidPayment,
    isLockedByStatus,
    hasPaidPayment,
  };
}
