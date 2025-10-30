// Common base types for entity management

export interface BaseEntity {
  id: string;
  active_flag: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityFormProps<T> {
  initialValues?: T;
  onSubmit: (values: T) => Promise<void>;
  isLoading?: boolean;
}

export interface EntityTableProps<T> {
  data: T[];
  isLoading?: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

// ============================================
// MEMBER PROGRESS DASHBOARD TYPES
// ============================================

/**
 * Trend indicator for health vitals
 */
export type TrendIndicator = 'improving' | 'stable' | 'declining' | 'no_data';

/**
 * Overall status indicator for member
 */
export type StatusIndicator = 'green' | 'yellow' | 'red';

/**
 * Goal status from Goals & Whys survey
 * - on_track: Making good progress toward goal
 * - win: Goal achieved
 * - at_risk: Struggling or off track
 * - insufficient_data: Not enough survey data to evaluate
 */
export type GoalStatus = 'on_track' | 'win' | 'at_risk' | 'insufficient_data';

/**
 * Individual health vital metric
 */
export interface HealthVital {
  score: number | null;
  trend: TrendIndicator | null;
  sparkline: number[];
}

/**
 * Alert (win or concern) from surveys
 */
export interface Alert {
  date: string;
  message: string;
  type?: string; // For wins: 'explicit'
  severity?: string; // For concerns: 'medium', 'high'
}

/**
 * SMART Goal from Goals & Whys survey
 */
export interface Goal {
  goal_text: string;
  status: GoalStatus;
  progress_summary?: string; // GPT's reasoning for the status assessment
}

/**
 * Complete member progress dashboard data
 * Returned from /api/member-progress/:leadId/dashboard
 */
export interface MemberProgressDashboard {
  // Identifiers
  lead_id: number;
  
  // Profile metrics
  status_indicator: StatusIndicator;
  status_score: number;
  days_in_program: number | null;
  projected_end_date: string | null;
  total_surveys_completed: number;
  last_survey_date: string | null;
  last_survey_name: string | null;
  
  // Health vitals (5 metrics)
  energy_score: number | null;
  energy_trend: TrendIndicator | null;
  energy_sparkline: number[];
  
  mood_score: number | null;
  mood_trend: TrendIndicator | null;
  mood_sparkline: number[];
  
  motivation_score: number | null;
  motivation_trend: TrendIndicator | null;
  motivation_sparkline: number[];
  
  wellbeing_score: number | null;
  wellbeing_trend: TrendIndicator | null;
  wellbeing_sparkline: number[];
  
  sleep_score: number | null;
  sleep_trend: TrendIndicator | null;
  sleep_sparkline: number[];
  
  // Compliance metrics
  nutrition_compliance_pct: number | null;
  nutrition_streak: number;
  supplements_compliance_pct: number | null;
  exercise_compliance_pct: number | null;
  exercise_days_per_week: number | null;
  meditation_compliance_pct: number | null;
  
  // Alerts
  latest_wins: Alert[];
  latest_concerns: Alert[];
  
  // Timeline progress
  module_sequence: string[]; // Complete ordered list of all modules for member's program
  completed_milestones: string[];
  next_milestone: string | null;
  overdue_milestones: string[];
  module_completion_dates: Record<string, string>; // Map of module_name → completion_date (ISO string)
  
  // Goals
  goals: Goal[];
  
  // Weight tracking
  current_weight: number | null;
  weight_change: number | null;
  
  // Metadata
  calculated_at: string;
  last_import_batch_id: number | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Helper type for health vitals object
 */
export interface HealthVitals {
  energy: HealthVital;
  mood: HealthVital;
  motivation: HealthVital;
  wellbeing: HealthVital;
  sleep: HealthVital;
}

/**
 * Helper type for compliance metrics
 */
export interface ComplianceMetrics {
  nutrition: {
    percentage: number | null;
    streak: number;
  };
  supplements: {
    percentage: number | null;
  };
  exercise: {
    percentage: number | null;
    daysPerWeek: number | null;
  };
  meditation: {
    percentage: number | null;
  };
}

/**
 * Helper type for timeline progress
 */
export interface TimelineProgress {
  completed: string[];
  next: string | null;
  overdue: string[];
}