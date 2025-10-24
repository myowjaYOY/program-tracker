import { SupabaseClient } from '@supabase/supabase-js';

/**
 * PROGRAM STATUS SERVICE
 * 
 * Single source of truth for determining which programs are "valid" for system operations.
 * 
 * DEFAULT RULE: Valid programs = Active status only
 * 
 * This ensures consistency across the application while allowing specific
 * components to request additional statuses when needed.
 * 
 * @example
 * // 90% case - Default: Get only Active programs
 * const activePrograms = await ProgramStatusService.getValidProgramIds(supabase);
 * 
 * @example
 * // 10% case - Include Paused programs too (for Coordinator operations)
 * const operationalPrograms = await ProgramStatusService.getValidProgramIds(supabase, {
 *   includeStatuses: ['paused']
 * });
 * 
 * @example
 * // 10% case - Get all programs (for audit/reporting)
 * const allPrograms = await ProgramStatusService.getValidProgramIds(supabase, {
 *   includeStatuses: ['all']
 * });
 */

/**
 * Exception types for requesting additional program statuses beyond the default (Active)
 */
export type ProgramStatusException = 
  | 'all'           // Include all statuses (for audit/reporting)
  | 'paused'        // Add Paused programs
  | 'quote'         // Add Quote programs
  | 'cancelled'     // Add Cancelled programs
  | 'completed';    // Add Completed programs

/**
 * Options for filtering valid programs
 */
export interface GetValidProgramsOptions {
  /** Filter to specific member/lead */
  memberId?: number;
  /** Additional statuses to include beyond default (Active) */
  includeStatuses?: ProgramStatusException[];
}

/**
 * Program Status Service
 * 
 * Centralized service for determining which programs are "valid" for system operations.
 * Provides a single source of truth for program status filtering across the entire application.
 */
export class ProgramStatusService {
  /**
   * Get valid program IDs based on status filtering rules
   * 
   * DEFAULT BEHAVIOR: Returns only Active programs
   * EXCEPTIONS: Can request additional statuses via includeStatuses parameter
   * 
   * This is the primary method used throughout the application to determine
   * which programs should be included in operations, metrics, and displays.
   * 
   * @param supabase - Supabase client instance
   * @param options - Optional filters and exceptions
   * @returns Promise resolving to array of valid program IDs
   * 
   * @example
   * // Get Active programs only (default)
   * const programIds = await ProgramStatusService.getValidProgramIds(supabase);
   * 
   * @example
   * // Get Active + Paused programs for a specific member
   * const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
   *   memberId: 123,
   *   includeStatuses: ['paused']
   * });
   * 
   * @example
   * // Get all programs regardless of status
   * const programIds = await ProgramStatusService.getValidProgramIds(supabase, {
   *   includeStatuses: ['all']
   * });
   */
  static async getValidProgramIds(
    supabase: SupabaseClient,
    options?: GetValidProgramsOptions
  ): Promise<number[]> {
    try {
      // Step 1: Determine which statuses to include
      const { data: statuses, error: statusError } = await supabase
        .from('program_status')
        .select('program_status_id, status_name');
      
      if (statusError) {
        console.error('ProgramStatusService: Error fetching statuses', statusError);
        return [];
      }
      
      if (!statuses || statuses.length === 0) {
        console.warn('ProgramStatusService: No program statuses found in database');
        return [];
      }
      
      // Step 2: Check if 'all' is requested (bypass filtering)
      if (options?.includeStatuses?.includes('all')) {
        let query = supabase
          .from('member_programs')
          .select('member_program_id');
        
        if (options.memberId) {
          query = query.eq('lead_id', options.memberId);
        }
        
        const { data: programs, error: programError } = await query;
        
        if (programError) {
          console.error('ProgramStatusService: Error fetching all programs', programError);
          return [];
        }
        
        return (programs || []).map(p => p.member_program_id);
      }
      
      // Step 3: Build list of included status names (default = 'active')
      const includedStatusNames = new Set<string>(['active']);
      
      // Add any requested exceptions
      if (options?.includeStatuses) {
        options.includeStatuses.forEach(status => {
          if (status !== 'all') {
            includedStatusNames.add(status.toLowerCase());
          }
        });
      }
      
      // Step 4: Get status IDs for included statuses
      const validStatusIds = statuses
        .filter(s => includedStatusNames.has((s.status_name || '').toLowerCase()))
        .map(s => s.program_status_id);
      
      if (validStatusIds.length === 0) {
        console.warn('ProgramStatusService: No matching status IDs found for requested statuses', 
          Array.from(includedStatusNames));
        return [];
      }
      
      // Step 5: Get programs with those statuses
      let query = supabase
        .from('member_programs')
        .select('member_program_id')
        .in('program_status_id', validStatusIds);
      
      if (options?.memberId) {
        query = query.eq('lead_id', options.memberId);
      }
      
      const { data: programs, error: programError } = await query;
      
      if (programError) {
        console.error('ProgramStatusService: Error fetching programs', programError);
        return [];
      }
      
      return (programs || []).map(p => p.member_program_id);
    } catch (error) {
      console.error('ProgramStatusService: Unexpected error in getValidProgramIds', error);
      return [];
    }
  }
  
  /**
   * Check if a specific program is valid based on status filtering rules
   * 
   * @param supabase - Supabase client instance
   * @param programId - Program ID to check
   * @param options - Optional exceptions (same as getValidProgramIds)
   * @returns Promise resolving to true if program is valid, false otherwise
   * 
   * @example
   * // Check if program is Active
   * const isValid = await ProgramStatusService.isProgramValid(supabase, 123);
   * 
   * @example
   * // Check if program is Active or Paused
   * const isValid = await ProgramStatusService.isProgramValid(supabase, 123, {
   *   includeStatuses: ['paused']
   * });
   */
  static async isProgramValid(
    supabase: SupabaseClient,
    programId: number,
    options?: GetValidProgramsOptions
  ): Promise<boolean> {
    try {
      const validIds = await this.getValidProgramIds(supabase, options);
      return validIds.includes(programId);
    } catch (error) {
      console.error('ProgramStatusService: Error in isProgramValid', error);
      return false;
    }
  }
  
  /**
   * Get valid status IDs (useful for direct database queries)
   * 
   * This method returns the status IDs themselves rather than program IDs,
   * which is useful when you need to filter at the status level in your queries.
   * 
   * @param supabase - Supabase client instance
   * @param options - Optional exceptions
   * @returns Promise resolving to array of valid status IDs
   * 
   * @example
   * // Get status IDs for Active programs
   * const statusIds = await ProgramStatusService.getValidStatusIds(supabase);
   * 
   * @example
   * // Get status IDs for Active + Paused programs
   * const statusIds = await ProgramStatusService.getValidStatusIds(supabase, {
   *   includeStatuses: ['paused']
   * });
   */
  static async getValidStatusIds(
    supabase: SupabaseClient,
    options?: Pick<GetValidProgramsOptions, 'includeStatuses'>
  ): Promise<number[]> {
    try {
      const { data: statuses, error: statusError } = await supabase
        .from('program_status')
        .select('program_status_id, status_name');
      
      if (statusError) {
        console.error('ProgramStatusService: Error fetching statuses', statusError);
        return [];
      }
      
      if (!statuses || statuses.length === 0) {
        console.warn('ProgramStatusService: No program statuses found in database');
        return [];
      }
      
      // Check if 'all' is requested
      if (options?.includeStatuses?.includes('all')) {
        return statuses.map(s => s.program_status_id);
      }
      
      // Build list of included status names (default = 'active')
      const includedStatusNames = new Set<string>(['active']);
      
      if (options?.includeStatuses) {
        options.includeStatuses.forEach(status => {
          if (status !== 'all') {
            includedStatusNames.add(status.toLowerCase());
          }
        });
      }
      
      const validStatusIds = statuses
        .filter(s => includedStatusNames.has((s.status_name || '').toLowerCase()))
        .map(s => s.program_status_id);
      
      if (validStatusIds.length === 0) {
        console.warn('ProgramStatusService: No matching status IDs found for requested statuses', 
          Array.from(includedStatusNames));
      }
      
      return validStatusIds;
    } catch (error) {
      console.error('ProgramStatusService: Unexpected error in getValidStatusIds', error);
      return [];
    }
  }
}

