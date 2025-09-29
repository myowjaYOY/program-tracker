'use client';

import React from 'react';
import { MemberPrograms } from '@/types/database.types';
import ProgramToDoTab from '@/components/programs/program-todo-tab';

interface DashboardProgramToDoTabProps {
  program: MemberPrograms;
}

/**
 * Readonly wrapper for ProgramToDoTab
 * Reuses the existing component which is already readonly
 */
export default function DashboardProgramToDoTab({
  program,
}: DashboardProgramToDoTabProps) {
  return <ProgramToDoTab program={program} />;
}
