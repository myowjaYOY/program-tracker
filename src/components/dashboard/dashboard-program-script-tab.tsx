'use client';

import React from 'react';
import { MemberPrograms } from '@/types/database.types';
import ProgramScriptTab from '@/components/programs/program-script-tab';

interface DashboardProgramScriptTabProps {
  program: MemberPrograms;
}

/**
 * Readonly wrapper for ProgramScriptTab
 * Reuses the existing component which is already readonly
 */
export default function DashboardProgramScriptTab({
  program,
}: DashboardProgramScriptTabProps) {
  return <ProgramScriptTab program={program} />;
}
