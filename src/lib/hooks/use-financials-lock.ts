import React from 'react';
import { MemberPrograms, MemberProgramPayments } from '@/types/database.types';
import { isProgramLocked, ProgramLockInfo } from '@/lib/utils/program-lock';

export default function useFinancialsLock(
  program: Partial<MemberPrograms> | null | undefined,
  payments: Partial<MemberProgramPayments>[] | null | undefined
): ProgramLockInfo {
  return React.useMemo(() => isProgramLocked(program, payments), [program, payments]);
}


