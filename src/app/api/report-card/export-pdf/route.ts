import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePdfFromHtml, wrapHtmlForPdf } from '@/lib/utils/pdf-generator';
import { fetchReportCardData } from '@/lib/utils/report-data-fetcher';
// Member progress data type removed - using any for flexibility

interface ExportRequest {
  memberId: number;
  sections: {
    memberProgress: boolean;
    msqAssessment: boolean;
    promisAssessment: boolean;
  };
}

// Helper function to generate Member Progress HTML
function generateMemberProgressHtml(data: any, memberInfo: { firstName: string; lastName: string }): string {
  const safeValue = (val: any, fallback = 'N/A') => val ?? fallback;
  const safePercent = (val: any) => val != null ? `${Math.round(val)}%` : '0%';
  
  // Get compliance color based on percentage
  const getComplianceColor = (pct: number | null): string => {
    if (pct === null) return '#9ca3af';
    if (pct >= 80) return '#10b981'; // Green
    if (pct >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };
  
  // Get trend color
  const getTrendColor = (trend: string | null): string => {
    if (!trend) return '#9ca3af';
    if (trend === 'improving') return '#10b981';
    if (trend === 'declining') return '#ef4444';
    return '#6b7280'; // stable
  };
  
  // Get trend symbol
  const getTrendSymbol = (trend: string | null): string => {
    if (!trend || trend === 'no_data') return '—';
    if (trend === 'improving') return '↑';
    if (trend === 'declining') return '↓';
    return '→'; // stable
  };
  
  return `
    <div style="margin-bottom: 32px;">
      <!-- Section Title -->
      <h2 style="font-weight: 700; font-size: 24px; margin-bottom: 24px; color: #8e24ff; border-bottom: 3px solid #8e24ff; padding-bottom: 12px;">
        Member Progress Dashboard
      </h2>

      <!-- Profile Information Card -->
      <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, ${
        data.status_indicator === 'green' ? '#f0fdf4' : 
        data.status_indicator === 'yellow' ? '#fffbeb' : '#fef2f2'
      } 0%, #ffffff 100%); border-left: 4px solid ${
        data.status_indicator === 'green' ? '#10b981' :
        data.status_indicator === 'yellow' ? '#f59e0b' : '#ef4444'
      }; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">📊 CURRENT SCORE</div>
              </div>
              <div style="font-size: 36px; font-weight: 700; color: ${
                data.status_indicator === 'green' ? '#10b981' :
                data.status_indicator === 'yellow' ? '#f59e0b' : '#ef4444'
              }; line-height: 1; margin-bottom: 4px;">${safeValue(data.status_score, '0')}</div>
              <div style="font-size: 13px; font-weight: 600; color: ${
                data.status_indicator === 'green' ? '#10b981' :
                data.status_indicator === 'yellow' ? '#f59e0b' : '#ef4444'
              };">
                ${
                  data.status_indicator === 'green' ? '✓ On Track' :
                  data.status_indicator === 'yellow' ? '⚠ Needs Monitoring' : '⚠ Needs Attention'
                }
              </div>
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">⏱️ DAYS IN PROGRAM</div>
              </div>
              <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${safeValue(data.days_in_program, '0')}</div>
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">📋 SURVEYS COMPLETED</div>
              </div>
              <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${safeValue(data.total_surveys_completed, '0')}</div>
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">⚖️ WEIGHT CHANGE</div>
              </div>
              ${data.weight_change !== null ? `
                <div style="font-size: 28px; font-weight: 700; color: ${
                  data.weight_change < 0 ? '#10b981' : // Green for loss
                  data.weight_change > 0 ? '#ef4444' : // Red for gain
                  '#6b7280' // Gray for no change
                }; line-height: 1; margin-bottom: 4px;">
                  ${data.weight_change > 0 ? '+' : ''}${data.weight_change} lbs
                </div>
                <div style="font-size: 12px; color: #666666;">Current: ${data.current_weight || 'N/A'} lbs</div>
              ` : `
                <div style="font-size: 16px; color: #999999;">No data</div>
              `}
            </td>
          </tr>
        </table>
      </div>

      <!-- Curriculum Progress -->
      ${data.next_milestone ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          📚 Curriculum Progress
        </h3>
        <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="width: 40%; padding: 20px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">▶️ NEXT MILESTONE</div>
              <div style="font-size: 18px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">${data.next_milestone}</div>
            </td>
            <td style="width: 30%; padding: 20px; border-left: 1px solid #e5e7eb; vertical-align: top;">
              <div style="font-size: 11px; color: #10b981; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">✓ COMPLETED</div>
              <div style="font-size: 32px; font-weight: 700; color: #10b981; line-height: 1;">${
                (() => {
                  try {
                    const parsed = typeof data.completed_milestones === 'string' 
                      ? JSON.parse(data.completed_milestones) 
                      : data.completed_milestones;
                    return Array.isArray(parsed) ? parsed.length : 0;
                  } catch {
                    return 0;
                  }
                })()
              }</div>
              <div style="font-size: 11px; color: #666666; font-weight: 600; margin-top: 4px;">modules</div>
            </td>
            <td style="width: 30%; padding: 20px; border-left: 1px solid #e5e7eb; vertical-align: top;">
              <div style="font-size: 11px; color: #ef4444; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">⚠️ OVERDUE</div>
              <div style="font-size: 32px; font-weight: 700; color: #ef4444; line-height: 1;">${
                (() => {
                  try {
                    const parsed = typeof data.overdue_milestones === 'string' 
                      ? JSON.parse(data.overdue_milestones) 
                      : data.overdue_milestones;
                    return Array.isArray(parsed) ? parsed.length : 0;
                  } catch {
                    return 0;
                  }
                })()
              }</div>
              <div style="font-size: 11px; color: #666666; font-weight: 600; margin-top: 4px;">modules</div>
            </td>
          </tr>
        </table>
      </div>
      ` : ''}

      <!-- Health Vitals Section -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          🏥 Health Vitals
        </h3>
        <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="width: 20%; padding: 16px; border-bottom: 3px solid #f59e0b; background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);">
              <div style="font-size: 12px; color: #78350f; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                ⚡ ENERGY
              </div>
              <div style="font-size: 32px; font-weight: 700; color: #f59e0b; line-height: 1;">${safeValue(data.energy_score, 'N/A')}</div>
              <div style="font-size: 12px; font-weight: 600; color: ${getTrendColor(data.energy_trend)}; margin-top: 4px;">
                ${getTrendSymbol(data.energy_trend)} ${data.energy_trend || 'N/A'}
              </div>
            </td>
            <td style="width: 20%; padding: 16px; border-bottom: 3px solid #8b5cf6; background: linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%);">
              <div style="font-size: 12px; color: #5b21b6; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                😊 MOOD
              </div>
              <div style="font-size: 32px; font-weight: 700; color: #8b5cf6; line-height: 1;">${safeValue(data.mood_score, 'N/A')}</div>
              <div style="font-size: 12px; font-weight: 600; color: ${getTrendColor(data.mood_trend)}; margin-top: 4px;">
                ${getTrendSymbol(data.mood_trend)} ${data.mood_trend || 'N/A'}
              </div>
            </td>
            <td style="width: 20%; padding: 16px; border-bottom: 3px solid #06b6d4; background: linear-gradient(180deg, #ecfeff 0%, #ffffff 100%);">
              <div style="font-size: 12px; color: #164e63; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                🏃 MOTIVATION
              </div>
              <div style="font-size: 32px; font-weight: 700; color: #06b6d4; line-height: 1;">${safeValue(data.motivation_score, 'N/A')}</div>
              <div style="font-size: 12px; font-weight: 600; color: ${getTrendColor(data.motivation_trend)}; margin-top: 4px;">
                ${getTrendSymbol(data.motivation_trend)} ${data.motivation_trend || 'N/A'}
              </div>
            </td>
            <td style="width: 20%; padding: 16px; border-bottom: 3px solid #ec4899; background: linear-gradient(180deg, #fdf2f8 0%, #ffffff 100%);">
              <div style="font-size: 12px; color: #831843; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                ❤️ WELLBEING
              </div>
              <div style="font-size: 32px; font-weight: 700; color: #ec4899; line-height: 1;">${safeValue(data.wellbeing_score, 'N/A')}</div>
              <div style="font-size: 12px; font-weight: 600; color: ${getTrendColor(data.wellbeing_trend)}; margin-top: 4px;">
                ${getTrendSymbol(data.wellbeing_trend)} ${data.wellbeing_trend || 'N/A'}
              </div>
            </td>
            <td style="width: 20%; padding: 16px; border-bottom: 3px solid #6366f1; background: linear-gradient(180deg, #eef2ff 0%, #ffffff 100%);">
              <div style="font-size: 12px; color: #312e81; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                😴 SLEEP QUALITY
              </div>
              <div style="font-size: 32px; font-weight: 700; color: #6366f1; line-height: 1;">${safeValue(data.sleep_score, 'N/A')}</div>
              <div style="font-size: 12px; font-weight: 600; color: ${getTrendColor(data.sleep_trend)}; margin-top: 4px;">
                ${getTrendSymbol(data.sleep_trend)} ${data.sleep_trend || 'N/A'}
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Protocol Compliance Section -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          ✅ Protocol Compliance
        </h3>
        <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="width: 25%; padding: 16px; vertical-align: top;">
              <div style="font-size: 12px; color: #666666; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                🥗 NUTRITION
              </div>
              <div style="font-size: 36px; font-weight: 700; color: ${getComplianceColor(data.nutrition_compliance_pct)}; line-height: 1; margin-bottom: 8px;">
                ${safePercent(data.nutrition_compliance_pct)}
              </div>
              <div style="height: 6px; background-color: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                <div style="height: 100%; background-color: ${getComplianceColor(data.nutrition_compliance_pct)}; width: ${data.nutrition_compliance_pct || 0}%;"></div>
              </div>
              <div style="font-size: 11px; color: #f59e0b; font-weight: 600;">
                🔥 ${safeValue(data.nutrition_streak, '0')} day streak
              </div>
            </td>
            <td style="width: 25%; padding: 16px; vertical-align: top;">
              <div style="font-size: 12px; color: #666666; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                💊 SUPPLEMENTS
              </div>
              <div style="font-size: 36px; font-weight: 700; color: ${getComplianceColor(data.supplements_compliance_pct)}; line-height: 1; margin-bottom: 8px;">
                ${safePercent(data.supplements_compliance_pct)}
              </div>
              <div style="height: 6px; background-color: #e5e7eb; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; background-color: ${getComplianceColor(data.supplements_compliance_pct)}; width: ${data.supplements_compliance_pct || 0}%;"></div>
              </div>
            </td>
            <td style="width: 25%; padding: 16px; vertical-align: top;">
              <div style="font-size: 12px; color: #666666; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                🏋️ EXERCISE
              </div>
              <div style="font-size: 36px; font-weight: 700; color: ${getComplianceColor(data.exercise_compliance_pct)}; line-height: 1; margin-bottom: 8px;">
                ${safePercent(data.exercise_compliance_pct)}
              </div>
              <div style="height: 6px; background-color: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                <div style="height: 100%; background-color: ${getComplianceColor(data.exercise_compliance_pct)}; width: ${data.exercise_compliance_pct || 0}%;"></div>
              </div>
              <div style="font-size: 11px; color: #666666; font-weight: 600;">
                ${safeValue(data.exercise_days_per_week, '0')} days/week
              </div>
            </td>
            <td style="width: 25%; padding: 16px; vertical-align: top;">
              <div style="font-size: 12px; color: #666666; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                🧘 MEDITATION
              </div>
              <div style="font-size: 36px; font-weight: 700; color: ${getComplianceColor(data.meditation_compliance_pct)}; line-height: 1; margin-bottom: 8px;">
                ${safePercent(data.meditation_compliance_pct)}
              </div>
              <div style="height: 6px; background-color: #e5e7eb; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; background-color: ${getComplianceColor(data.meditation_compliance_pct)}; width: ${data.meditation_compliance_pct || 0}%;"></div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Goals and Progress Section -->
      ${(() => {
        try {
          const goals = typeof data.goals === 'string' ? JSON.parse(data.goals) : data.goals;
          if (!goals || !Array.isArray(goals) || goals.length === 0) return '';
          
          return `
      <div style="margin-bottom: 24px; page-break-before: always; padding-top: 48px;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          🎯 Goals and Progress
        </h3>
        <div style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          ${goals.map((goal: any, index: number) => {
              const statusConfig = {
                'on_track': { color: '#10b981', icon: '✓', label: 'On Track', bgColor: '#f0fdf4' },
                'win': { color: '#10b981', icon: '🏆', label: 'Win', bgColor: '#f0fdf4' },
                'at_risk': { color: '#ef4444', icon: '⚠', label: 'At Risk', bgColor: '#fef2f2' },
                'insufficient_data': { color: '#9ca3af', icon: '—', label: 'Insufficient Data', bgColor: '#f9fafb' }
              };
              const config = statusConfig[goal.status as keyof typeof statusConfig] || statusConfig.insufficient_data;
              
              return `
                <div style="padding: 16px; border-bottom: ${index < goals.length - 1 ? '1px solid #e5e7eb' : 'none'}; background-color: ${config.bgColor};">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="width: 60%; vertical-align: top; padding-right: 16px;">
                        <div style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; line-height: 1.4;">
                          ${goal.goal_text || 'Untitled Goal'}
                        </div>
                        ${goal.progress_summary ? `
                          <div style="font-size: 13px; color: #666666; line-height: 1.5; font-style: italic;">
                            ${goal.progress_summary}
                          </div>
                        ` : ''}
                      </td>
                      <td style="width: 40%; vertical-align: middle; text-align: right;">
                        <div style="display: inline-block; padding: 8px 16px; background-color: ${config.color}20; border-left: 3px solid ${config.color}; border-radius: 6px;">
                          <div style="font-size: 20px; margin-bottom: 2px;">${config.icon}</div>
                          <div style="font-size: 13px; font-weight: 700; color: ${config.color}; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${config.label}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>
              `;
            }).join('')}
        </div>
      </div>
      `;
        } catch (error) {
          console.error('Error rendering goals section:', error);
          return '';
        }
      })()}
    </div>
  `;
}

// Helper function to generate MSQ Assessment HTML
function generateMsqAssessmentHtml(msqData: any, memberInfo: { firstName: string; lastName: string }, isFirstSection: boolean = false): string {
  const summary = msqData.summary;
  const domains = msqData.domains;
  
  const safeValue = (val: any, fallback = 'N/A') => val ?? fallback;
  
  // Calculate total MSQ score from all domains
  const totalScore = summary.all_total_scores?.[summary.all_total_scores.length - 1] || 0;
  const firstScore = summary.all_total_scores?.[0] || 0;
  const scoreChange = totalScore - firstScore;
  const assessmentCount = summary.assessment_dates?.length || 0;
  
  // Determine severity level and color based on total MSQ score
  const getSeverityLevel = (score: number): { level: string; color: string; bgColor: string } => {
    if (score === 0 || score <= 10) return { level: 'Optimal', color: '#10b981', bgColor: '#f0fdf4' };
    if (score <= 30) return { level: 'Mild', color: '#84cc16', bgColor: '#f7fee7' };
    if (score <= 60) return { level: 'Moderate', color: '#f59e0b', bgColor: '#fffbeb' };
    if (score <= 100) return { level: 'Severe', color: '#ef4444', bgColor: '#fef2f2' };
    return { level: 'Very Severe', color: '#991b1b', bgColor: '#fef2f2' };
  };
  
  // Get domain severity color (matches DomainCardsGrid.tsx)
  const getDomainSeverityColor = (severity: string): string => {
    if (severity === 'minimal') return '#10b981'; // Green
    if (severity === 'mild') return '#f59e0b'; // Orange
    if (severity === 'moderate') return '#ef4444'; // Red
    if (severity === 'severe') return '#991b1b'; // Dark Red
    return '#9ca3af';
  };
  
  // Get trend info
  const getTrendInfo = (trend: string | null): { symbol: string; color: string; label: string } => {
    if (!trend || trend === 'no_data') return { symbol: '—', color: '#9ca3af', label: 'No Data' };
    if (trend === 'improving') return { symbol: '↓', color: '#10b981', label: 'Improving' };
    if (trend === 'declining') return { symbol: '↑', color: '#ef4444', label: 'Worsening' };
    return { symbol: '→', color: '#6b7280', label: 'Stable' };
  };
  
  // Get clinical interpretation for trend
  const getTrendInterpretation = (): string => {
    if (assessmentCount < 2) return 'Insufficient data';
    const absChange = Math.abs(scoreChange);
    const pctChange = firstScore > 0 ? (absChange / firstScore) * 100 : 0;
    
    if (scoreChange <= -50 || pctChange >= 50) return 'Major transformation';
    if (scoreChange <= -30) return 'Significant improvement';
    if (scoreChange <= -10) return 'Measurable improvement';
    if (Math.abs(scoreChange) < 10) return 'Minimal change';
    if (scoreChange >= 10 && scoreChange < 30) return 'Measurable worsening';
    if (scoreChange >= 30) return 'Significant decline';
    return 'Stable';
  };
  
  const currentLevel = getSeverityLevel(totalScore);
  const trendInfo = getTrendInfo(summary.total_score_trend);
  const trendInterpretation = getTrendInterpretation();
  
  // Find top problem area (highest scoring domain)
  const topDomain = domains.reduce((max: any, d: any) => 
    d.average_score > (max?.average_score || 0) ? d : max, null);
  
  // Get domain emoji mapping
  const domainEmojis: Record<string, string> = {
    'head': '🧠',
    'eyes': '👁️',
    'ears': '👂',
    'nose': '👃',
    'mouth_throat': '👄',
    'digestive_tract': '🍽️',
    'heart': '💓',
    'lungs': '🫁',
    'joints_muscle': '🦴',
    'skin': '🧴',
    'energy_activity': '💪',
    'mind': '🤔',
    'emotions': '😊',
    'weight': '⚖️',
    'other': '📋'
  };
  
  return `
    <div style="margin-bottom: 32px; ${isFirstSection ? '' : 'page-break-before: always; padding-top: 48px;'}">
      <!-- Section Title -->
      <h2 style="font-weight: 700; font-size: 24px; margin-bottom: 24px; color: #8e24ff; border-bottom: 3px solid #8e24ff; padding-bottom: 12px;">
        MSQ Clinical Assessment
      </h2>

      <!-- Patient-Specific Profile Card -->
      <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, ${currentLevel.bgColor} 0%, #ffffff 100%); border-left: 4px solid ${currentLevel.color}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📊 CURRENT SCORE</div>
              <div style="font-size: 36px; font-weight: 700; color: ${currentLevel.color}; line-height: 1; margin-bottom: 4px;">${totalScore}</div>
              <div style="font-size: 13px; font-weight: 600; color: ${currentLevel.color};">
                ${currentLevel.level}
              </div>
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📈 TREND</div>
              <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">
                <div style="font-size: 32px; font-weight: 700; color: ${trendInfo.color}; line-height: 1;">
                  ${trendInfo.symbol}
                </div>
                <div style="font-size: 13px; font-weight: 600; color: ${trendInfo.color};">
                  ${trendInfo.label}
                </div>
              </div>
              <div style="font-size: 11px; color: #666666; margin-top: 4px;">
                ${trendInterpretation}
              </div>
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🔍 TOP PROBLEM AREA</div>
              ${topDomain ? `
                <div style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">
                  ${domainEmojis[topDomain.domain_key] || '📋'} ${topDomain.domain_label}
                </div>
                <div style="font-size: 13px; color: ${getDomainSeverityColor(topDomain.severity)}; font-weight: 600;">
                  Score: ${topDomain.average_score.toFixed(1)}
                </div>
              ` : `
                <div style="font-size: 16px; color: #999999;">No significant issues</div>
              `}
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📅 ASSESSMENT SCORES</div>
              ${summary.all_total_scores && summary.all_total_scores.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse;">
                  ${(() => {
                    const scores = summary.all_total_scores;
                    const dates = summary.assessment_dates;
                    const rows = Math.ceil(scores.length / 2);
                    let html = '';
                    
                    for (let row = 0; row < rows; row++) {
                      const idx1 = row * 2;
                      const idx2 = row * 2 + 1;
                      
                      html += '<tr>';
                      
                      // Column 1
                      if (idx1 < scores.length) {
                        html += `
                          <td style="padding: 2px 4px 2px 0; font-size: 11px; color: #666666;">
                            <span style="font-weight: 600; color: #1a1a1a;">${Math.round(scores[idx1])}</span>
                            <span style="color: #999999; font-size: 10px;"> (${dates?.[idx1] ? new Date(dates[idx1]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''})</span>
                          </td>
                        `;
                      } else {
                        html += '<td></td>';
                      }
                      
                      // Column 2
                      if (idx2 < scores.length) {
                        html += `
                          <td style="padding: 2px 0 2px 4px; font-size: 11px; color: #666666;">
                            <span style="font-weight: 600; color: #1a1a1a;">${Math.round(scores[idx2])}</span>
                            <span style="color: #999999; font-size: 10px;"> (${dates?.[idx2] ? new Date(dates[idx2]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''})</span>
                          </td>
                        `;
                      } else {
                        html += '<td></td>';
                      }
                      
                      html += '</tr>';
                    }
                    
                    return html;
                  })()}
                </table>
              ` : `
                <div style="font-size: 12px; color: #999999;">No assessments yet</div>
              `}
            </td>
          </tr>
        </table>
      </div>

      <!-- Body Systems Analysis (15 Domain Cards) -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          🏥 Body Systems Analysis
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${domains.map((domain: any, index: number) => {
            // Create rows of 3 domains each
            if (index % 3 !== 0) return '';
            
            const domainsInRow = domains.slice(index, index + 3);
            return `
              <tr>
                ${domainsInRow.map((d: any) => `
                  <td style="width: 33.33%; padding: 8px; vertical-align: top;">
                    <div style="background-color: white; border-top: 3px solid ${getDomainSeverityColor(d.severity)}; border-radius: 4px; padding: 12px; height: 100%; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                      <!-- Domain Header -->
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="font-size: 16px;">${domainEmojis[d.domain_key] || '📋'}</span>
                          <span style="font-size: 12px; font-weight: 700; color: #1a1a1a;">${d.domain_label}</span>
                        </div>
                        <span style="font-size: 20px; color: ${getTrendInfo(d.trend).color}; font-weight: 700; line-height: 1;">
                          ${getTrendInfo(d.trend).symbol}
                        </span>
                      </div>
                      
                      <!-- Score and Severity -->
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <div style="background-color: ${getDomainSeverityColor(d.severity)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                          ${d.average_score.toFixed(1)}
                        </div>
                        <div style="font-size: 11px; color: ${getDomainSeverityColor(d.severity)}; font-weight: 600; text-transform: capitalize;">
                          ${d.severity}
                        </div>
                      </div>
                      
                      <!-- Top 3 Symptoms -->
                      ${d.symptoms && d.symptoms.length > 0 ? `
                        <div style="font-size: 10px; color: #666666; margin-top: 8px;">
                          ${d.symptoms.slice(0, 3).map((symptom: any, idx: number) => `
                            <div style="margin-bottom: 4px; display: flex; justify-content: space-between;">
                              <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${symptom.question_text}</span>
                              <span style="font-weight: 600; margin-left: 4px;">${symptom.recent_score}</span>
                            </div>
                          `).join('')}
                        </div>
                      ` : `
                        <div style="font-size: 10px; color: #999999; font-style: italic;">No symptoms reported</div>
                      `}
                    </div>
                  </td>
                `).join('')}
                ${domainsInRow.length < 3 ? '<td></td>'.repeat(3 - domainsInRow.length) : ''}
              </tr>
            `;
          }).filter(Boolean).join('')}
        </table>
      </div>

      <!-- MSQ Interpretation Guide -->
      <div style="margin-top: 32px; padding-top: 48px; page-break-inside: avoid;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          📚 MSQ Interpretation Guide
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="width: 50%; padding: 8px; vertical-align: top;">
              <div style="background-color: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); height: 100%;">
                <div style="font-size: 14px; font-weight: 700; color: #8e24ff; margin-bottom: 12px;">📊 MSQ Score Interpretation</div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #10b981;">0-10 Points</div>
                      <div style="font-size: 11px; color: #666666;">Optimal health, minimal symptoms</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #84cc16;">11-30 Points</div>
                      <div style="font-size: 11px; color: #666666;">Mild symptoms, monitor trends</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #f59e0b;">31-60 Points</div>
                      <div style="font-size: 11px; color: #666666;">Moderate burden, intervention recommended</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #ef4444;">61-100 Points</div>
                      <div style="font-size: 11px; color: #666666;">Severe symptoms, requires immediate attention</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px;">
                      <div style="font-size: 12px; font-weight: 600; color: #991b1b;">100+ Points</div>
                      <div style="font-size: 11px; color: #666666;">Very severe, comprehensive protocol needed</div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
            <td style="width: 50%; padding: 8px; vertical-align: top;">
              <div style="background-color: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); height: 100%;">
                <div style="font-size: 14px; font-weight: 700; color: #8e24ff; margin-bottom: 12px;">📈 Trend Analysis Guidelines</div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #10b981;">↓ Improving (Score Decreasing)</div>
                      <div style="font-size: 11px; color: #666666;">Symptoms reducing, protocol working</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #6b7280;">→ Stable (No Significant Change)</div>
                      <div style="font-size: 11px; color: #666666;">Symptoms maintained, continue monitoring</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px;">
                      <div style="font-size: 12px; font-weight: 600; color: #ef4444;">↑ Worsening (Score Increasing)</div>
                      <div style="font-size: 11px; color: #666666;">Symptoms intensifying, protocol adjustment needed</div>
                    </td>
                  </tr>
                </table>
                
                <div style="margin-top: 16px; padding: 12px; background-color: #f3f0ff; border-radius: 6px;">
                  <div style="font-size: 11px; font-weight: 600; color: #8e24ff; margin-bottom: 4px;">📌 Clinical Notes</div>
                  <div style="font-size: 10px; color: #666666; line-height: 1.5;">
                    • Changes of ≥10 points are clinically significant<br/>
                    • Focus intervention on domains scoring ≥10<br/>
                    • Re-assess every 4-8 weeks for optimal tracking<br/>
                    • Multiple high-scoring domains suggest systemic issues
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

// Helper function to generate PROMIS-29 Assessment HTML
function generatePromisAssessmentHtml(promisData: any, memberInfo: { firstName: string; lastName: string }, isFirstSection: boolean = false): string {
  const summary = promisData.summary;
  const domains = promisData.domains;
  
  const safeValue = (val: any, fallback = 'N/A') => val ?? fallback;
  
  // Calculate current mean T-score and trend
  const currentMeanTScore = summary.current_mean_t_score || 50;
  const assessmentCount = summary.assessment_dates?.length || 0;
  const firstScore = summary.all_mean_t_scores?.[0] || 50;
  const scoreChange = currentMeanTScore - firstScore;
  
  // Get severity level and color based on mean T-score (matches dashboard getMeanTScoreColor)
  const getSeverityLevel = (score: number): { level: string; color: string; bgColor: string } => {
    if (score >= 45 && score <= 55) {
      return { level: 'Within Normal', color: '#10b981', bgColor: '#f0fdf4' }; // Green
    } else if (score < 45 || score < 60) {
      return { level: 'Mild', color: '#f59e0b', bgColor: '#fffbeb' }; // Amber
    } else if (score < 65) {
      return { level: 'Moderate', color: '#ef4444', bgColor: '#fef2f2' }; // Red
    } else {
      return { level: 'Severe', color: '#dc2626', bgColor: '#fef2f2' }; // Dark Red
    }
  };
  
  // Get domain severity color (matches PromisDomainCardsGrid.tsx getSeverityColor)
  const getDomainSeverityColor = (severity: string): string => {
    const severityLower = severity.toLowerCase();
    if (severityLower === 'within_normal') return '#10b981'; // Green
    if (severityLower === 'mild' || severityLower === 'mild_limitation') return '#f59e0b'; // Orange
    if (severityLower === 'moderate' || severityLower === 'moderate_limitation') return '#ef4444'; // Red
    if (severityLower === 'severe' || severityLower === 'severe_limitation') return '#dc2626'; // Dark Red
    if (severityLower === 'very_severe' || severityLower === 'very_severe_limitation') return '#991b1b'; // Very Dark Red
    return '#9ca3af'; // Gray
  };
  
  // Get trend info
  const getTrendInfo = (trend: string | null): { symbol: string; color: string; label: string } => {
    if (!trend || trend === 'no_data' || trend === 'stable') return { symbol: '→', color: '#6b7280', label: 'Stable' };
    if (trend === 'improving') return { symbol: '↓', color: '#10b981', label: 'Improving' };
    if (trend === 'worsening' || trend === 'declining') return { symbol: '↑', color: '#ef4444', label: 'Worsening' };
    return { symbol: '→', color: '#6b7280', label: 'Stable' };
  };
  
  // Get clinical interpretation for trend
  const getTrendInterpretation = (): string => {
    if (assessmentCount < 2) return 'Insufficient data';
    const absChange = Math.abs(scoreChange);
    
    if (absChange < 5) return 'Minimal change';
    if (absChange >= 5 && absChange <= 10) return 'Moderate change';
    return 'Substantial change';
  };
  
  const currentLevel = getSeverityLevel(currentMeanTScore);
  const trendInfo = getTrendInfo(summary.total_score_trend);
  const trendInterpretation = getTrendInterpretation();
  
  // Find top problem domains (highest scoring symptom domains or lowest scoring function domains)
  const topDomain = domains.reduce((max: any, d: any) => {
    const isDomainFunction = d.domain_key === 'physical_function' || d.domain_key === 'social_roles';
    const score = d.current_score || 0;
    
    if (!max) return d;
    
    const maxIsFun = max.domain_key === 'physical_function' || max.domain_key === 'social_roles';
    const maxScore = max.current_score || 0;
    
    // For symptom domains, higher is worse
    // For function domains, lower is worse
    if (isDomainFunction) {
      return score < maxScore ? d : max;
    } else {
      return score > maxScore ? d : max;
    }
  }, null);
  
  // Get domain emoji mapping
  const domainEmojis: Record<string, string> = {
    'physical_function': '🏃',
    'anxiety': '😰',
    'depression': '😔',
    'fatigue': '😴',
    'sleep_disturbance': '🌙',
    'social_roles': '👥',
    'pain_interference': '🤕',
    'pain_intensity': '⚡'
  };
  
  return `
    <div style="margin-bottom: 32px; ${isFirstSection ? '' : 'page-break-before: always; padding-top: 48px;'}">
      <!-- Section Title -->
      <h2 style="font-weight: 700; font-size: 24px; margin-bottom: 24px; color: #8e24ff; border-bottom: 3px solid #8e24ff; padding-bottom: 12px;">
        PROMIS-29 Health Assessment
      </h2>

      <!-- Patient-Specific Profile Card -->
      <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, ${currentLevel.bgColor} 0%, #ffffff 100%); border-left: 4px solid ${currentLevel.color}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📊 CURRENT SCORE</div>
              <div style="font-size: 36px; font-weight: 700; color: ${currentLevel.color}; line-height: 1; margin-bottom: 4px;">${currentMeanTScore.toFixed(1)}</div>
              <div style="font-size: 13px; font-weight: 600; color: ${currentLevel.color};">
                ${currentLevel.level}
              </div>
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📈 TREND</div>
              <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">
                <div style="font-size: 32px; font-weight: 700; color: ${trendInfo.color}; line-height: 1;">
                  ${trendInfo.symbol}
                </div>
                <div style="font-size: 13px; font-weight: 600; color: ${trendInfo.color};">
                  ${trendInfo.label}
                </div>
              </div>
              <div style="font-size: 11px; color: #666666; margin-top: 4px;">
                ${trendInterpretation}
              </div>
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🔍 TOP CONCERN</div>
              ${topDomain ? `
                <div style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">
                  ${domainEmojis[topDomain.domain_key] || '📋'} ${topDomain.domain_label}
                </div>
                <div style="font-size: 13px; color: ${getDomainSeverityColor(topDomain.severity)}; font-weight: 600;">
                  ${topDomain.domain_key === 'pain_intensity' ? `Score: ${topDomain.current_score}/10` : `T-Score: ${topDomain.current_score.toFixed(0)}`}
                </div>
              ` : `
                <div style="font-size: 16px; color: #999999;">All domains normal</div>
              `}
            </td>
            <td style="width: 25%; padding: 12px; vertical-align: top;">
              <div style="font-size: 11px; color: #8e24ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📅 ASSESSMENT SCORES</div>
              ${summary.all_mean_t_scores && summary.all_mean_t_scores.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse;">
                  ${(() => {
                    const scores = summary.all_mean_t_scores;
                    const dates = summary.assessment_dates;
                    const rows = Math.ceil(scores.length / 2);
                    let html = '';
                    
                    for (let row = 0; row < rows; row++) {
                      const idx1 = row * 2;
                      const idx2 = row * 2 + 1;
                      
                      html += '<tr>';
                      
                      // Column 1
                      if (idx1 < scores.length) {
                        html += `
                          <td style="padding: 2px 4px 2px 0; font-size: 11px; color: #666666;">
                            <span style="font-weight: 600; color: #1a1a1a;">${scores[idx1].toFixed(1)}</span>
                            <span style="color: #999999; font-size: 10px;"> (${dates?.[idx1] ? new Date(dates[idx1]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''})</span>
                          </td>
                        `;
                      } else {
                        html += '<td></td>';
                      }
                      
                      // Column 2
                      if (idx2 < scores.length) {
                        html += `
                          <td style="padding: 2px 0 2px 4px; font-size: 11px; color: #666666;">
                            <span style="font-weight: 600; color: #1a1a1a;">${scores[idx2].toFixed(1)}</span>
                            <span style="color: #999999; font-size: 10px;"> (${dates?.[idx2] ? new Date(dates[idx2]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''})</span>
                          </td>
                        `;
                      } else {
                        html += '<td></td>';
                      }
                      
                      html += '</tr>';
                    }
                    
                    return html;
                  })()}
                </table>
              ` : `
                <div style="font-size: 12px; color: #999999;">No assessments yet</div>
              `}
            </td>
          </tr>
        </table>
      </div>

      <!-- Health Domains Analysis (8 Domain Cards, 3 per row) -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          🏥 Health Domains Analysis
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${domains.map((domain: any, index: number) => {
            // Create rows of 3 domains each
            if (index % 3 !== 0) return '';
            
            const domainsInRow = domains.slice(index, index + 3);
            const isPainIntensity = (d: any) => d.domain_key === 'pain_intensity';
            
            return `
              <tr>
                ${domainsInRow.map((d: any) => `
                  <td style="width: 33.33%; padding: 8px; vertical-align: top;">
                    <div style="background-color: white; border-top: 3px solid ${getDomainSeverityColor(d.severity)}; border-radius: 4px; padding: 12px; height: 100%; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                      <!-- Domain Header -->
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="font-size: 16px;">${domainEmojis[d.domain_key] || '📋'}</span>
                          <span style="font-size: 12px; font-weight: 700; color: #1a1a1a;">${d.domain_label}</span>
                        </div>
                        <span style="font-size: 20px; color: ${getTrendInfo(d.trend).color}; font-weight: 700; line-height: 1;">
                          ${getTrendInfo(d.trend).symbol}
                        </span>
                      </div>
                      
                      <!-- Score and Severity -->
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <div style="background-color: ${getDomainSeverityColor(d.severity)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                          ${isPainIntensity(d) ? `${d.current_score}/10` : `T: ${d.current_score.toFixed(0)}`}
                        </div>
                        <div style="font-size: 11px; color: ${getDomainSeverityColor(d.severity)}; font-weight: 600; text-transform: capitalize;">
                          ${d.severity.replace(/_/g, ' ')}
                        </div>
                      </div>
                      
                      <!-- Domain Type Note -->
                      ${d.domain_key === 'physical_function' || d.domain_key === 'social_roles' ? `
                        <div style="font-size: 10px; color: #666666; font-style: italic; margin-top: 4px;">
                          Function domain: Higher scores indicate better function
                        </div>
                      ` : ''}
                    </div>
                  </td>
                `).join('')}
                ${domainsInRow.length < 3 ? '<td></td>'.repeat(3 - domainsInRow.length) : ''}
              </tr>
            `;
          }).filter(Boolean).join('')}
        </table>
      </div>

      <!-- PROMIS Interpretation Guide -->
      <div style="margin-top: 32px; padding-top: 48px; page-break-inside: avoid;">
        <h3 style="font-weight: 700; font-size: 18px; margin-bottom: 16px; color: #1a1a1a;">
          📚 PROMIS-29 Interpretation Guide
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="width: 50%; padding: 8px; vertical-align: top;">
              <div style="background-color: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); height: 100%;">
                <div style="font-size: 14px; font-weight: 700; color: #8e24ff; margin-bottom: 12px;">📊 T-Score Interpretation</div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #10b981;">< 45 Points</div>
                      <div style="font-size: 11px; color: #666666;">Within normal limits (symptom domains)</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #f59e0b;">45-54 Points</div>
                      <div style="font-size: 11px; color: #666666;">Mild symptoms or mild functional limitation</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #ef4444;">55-64 Points</div>
                      <div style="font-size: 11px; color: #666666;">Moderate symptoms, intervention recommended</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #dc2626;">65-74 Points</div>
                      <div style="font-size: 11px; color: #666666;">Severe symptoms, requires attention</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px;">
                      <div style="font-size: 12px; font-weight: 600; color: #991b1b;">≥ 75 Points</div>
                      <div style="font-size: 11px; color: #666666;">Very severe, urgent intervention needed</div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
            <td style="width: 50%; padding: 8px; vertical-align: top;">
              <div style="background-color: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); height: 100%;">
                <div style="font-size: 14px; font-weight: 700; color: #8e24ff; margin-bottom: 12px;">📈 Clinical Significance</div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #10b981;">↓ Improving (Score Decreasing)</div>
                      <div style="font-size: 11px; color: #666666;">Symptoms improving, treatment effective</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                      <div style="font-size: 12px; font-weight: 600; color: #6b7280;">→ Stable (No Change)</div>
                      <div style="font-size: 11px; color: #666666;">Symptoms maintained, continue monitoring</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px;">
                      <div style="font-size: 12px; font-weight: 600; color: #ef4444;">↑ Worsening (Score Increasing)</div>
                      <div style="font-size: 11px; color: #666666;">Symptoms intensifying, adjust treatment</div>
                    </td>
                  </tr>
                </table>
                
                <div style="margin-top: 16px; padding: 12px; background-color: #f3f0ff; border-radius: 6px;">
                  <div style="font-size: 11px; font-weight: 600; color: #8e24ff; margin-bottom: 4px;">📌 Clinical Notes</div>
                  <div style="font-size: 10px; color: #666666; line-height: 1.5;">
                    • T-scores are standardized: Mean = 50, SD = 10<br/>
                    • Change of ≥5 points is clinically meaningful<br/>
                    • Function domains: Higher = better function<br/>
                    • Symptom domains: Lower = fewer symptoms<br/>
                    • Pain Intensity uses 0-10 scale (not T-scores)
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

// Helper function to generate report layout HTML
function generateReportHtml(memberName: string, reportDate: string, contentHtml: string): string {
  return `
    <div style="max-width: 100%; padding: 32px; background: linear-gradient(135deg, #ffffff 0%, #f9f7ff 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <!-- Header -->
      <div style="margin-bottom: 32px; padding: 24px; background: linear-gradient(135deg, #8e24ff 0%, #5a0ea4 100%); border-radius: 12px; box-shadow: 0 4px 16px rgba(142, 36, 255, 0.2);">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <h1 style="font-size: 36px; font-weight: 900; color: #ffffff; margin: 0 0 8px 0; letter-spacing: -0.5px;">
                📊 Member Report Card
              </h1>
              <p style="font-size: 20px; color: #e9d5ff; margin: 0; font-weight: 600;">
                ${memberName}
              </p>
            </td>
            <td style="text-align: right; vertical-align: middle; white-space: nowrap; padding-left: 24px;">
              <div style="background-color: rgba(255, 255, 255, 0.2); padding: 12px 16px; border-radius: 8px; backdrop-filter: blur(10px);">
                <div style="font-size: 10px; color: #e9d5ff; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Generated On</div>
                <div style="font-size: 16px; font-weight: 700; color: #ffffff;">${reportDate}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Content -->
      ${contentHtml}
      
      <!-- Footer -->
      <div style="margin-top: 48px; padding: 20px; background: linear-gradient(135deg, #f3f0ff 0%, #e9d5ff 50%, #ddd6fe 100%); border-radius: 12px; text-align: center;">
        <div style="margin-bottom: 12px; padding: 12px; background-color: rgba(255, 255, 255, 0.6); border-radius: 8px; display: inline-block;">
          <p style="margin: 0; font-size: 12px; color: #5a0ea4; font-weight: 600;">
            🔒 This report contains confidential health information
          </p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #7c3aed;">
            Please handle with appropriate privacy and security measures
          </p>
        </div>
        <p style="margin: 16px 0 0 0; font-size: 11px; color: #8b5cf6; font-weight: 600;">
          © ${new Date().getFullYear()} Program Tracker • Powered by Advanced Health Analytics
        </p>
      </div>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Received PDF export request');
    
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: ExportRequest = await request.json();
    const { memberId, sections } = body;

    if (!memberId || !sections) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, sections' },
        { status: 400 }
      );
    }

    console.log(`👤 Fetching data for member ID: ${memberId}`);
    
    // 3. Fetch report data server-side
    const reportData = await fetchReportCardData(supabase, memberId, { sections });

    // 4. Generate HTML content
    console.log('🎨 Generating HTML...');
    
    let contentHtml = '';
    let isFirstSection = true; // Track if this is the first section to avoid blank pages
    
    if (sections.memberProgress) {
      if (reportData.memberProgress) {
        const memberInfo = {
          firstName: reportData.member.firstName,
          lastName: reportData.member.lastName,
        };
        contentHtml += generateMemberProgressHtml(reportData.memberProgress, memberInfo);
        isFirstSection = false;
      } else {
        // No dashboard data available
        contentHtml += `
          <div style="margin-bottom: 32px; padding: 32px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
            <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #856404;">
              Member Progress Data Not Available
            </h3>
            <p style="margin: 0; color: #856404; font-size: 14px;">
              Dashboard data will be available after the member completes their first survey import.
            </p>
          </div>
        `;
        isFirstSection = false;
      }
    }
    
    // MSQ Assessment section
    if (sections.msqAssessment) {
      if (reportData.msqAssessment) {
        const memberInfo = {
          firstName: reportData.member.firstName,
          lastName: reportData.member.lastName,
        };
        contentHtml += generateMsqAssessmentHtml(reportData.msqAssessment, memberInfo, isFirstSection);
        isFirstSection = false;
      } else {
        // No MSQ data available
        contentHtml += `
          <div style="margin-bottom: 32px; ${isFirstSection ? '' : 'page-break-before: always; padding-top: 48px;'}">
            <h2 style="font-weight: 700; font-size: 24px; margin-bottom: 24px; color: #8e24ff; border-bottom: 3px solid #8e24ff; padding-bottom: 12px;">
              MSQ Clinical Assessment
            </h2>
            <div style="padding: 32px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #856404;">
                MSQ Assessment Data Not Available
              </h3>
              <p style="margin: 0; color: #856404; font-size: 14px;">
                MSQ assessment data will be available after the member completes their first MSQ survey.
              </p>
            </div>
          </div>
        `;
        isFirstSection = false;
      }
    }
    
    // PROMIS-29 Assessment section
    if (sections.promisAssessment) {
      if (reportData.promisAssessment) {
        const memberInfo = {
          firstName: reportData.member.firstName,
          lastName: reportData.member.lastName,
        };
        contentHtml += generatePromisAssessmentHtml(reportData.promisAssessment, memberInfo, isFirstSection);
        isFirstSection = false;
      } else {
        // No PROMIS data available
        contentHtml += `
          <div style="margin-bottom: 32px; ${isFirstSection ? '' : 'page-break-before: always; padding-top: 48px;'}">
            <h2 style="font-weight: 700; font-size: 24px; margin-bottom: 24px; color: #8e24ff; border-bottom: 3px solid #8e24ff; padding-bottom: 12px;">
              PROMIS-29 Health Assessment
            </h2>
            <div style="padding: 32px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #856404;">
                PROMIS-29 Assessment Data Not Available
              </h3>
              <p style="margin: 0; color: #856404; font-size: 14px;">
                PROMIS-29 assessment data will be available after the member completes their first PROMIS survey.
              </p>
            </div>
          </div>
        `;
        isFirstSection = false;
      }
    }
    
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const reportHtml = generateReportHtml(reportData.member.name, reportDate, contentHtml);
    const fullHtml = wrapHtmlForPdf(reportHtml);

    // Debug: Log HTML length
    console.log(`📝 Generated HTML length: ${fullHtml.length} characters`);
    console.log(`📊 Content sections: memberProgress=${!!reportData.memberProgress}, msqAssessment=${!!reportData.msqAssessment}, promisAssessment=${!!reportData.promisAssessment}`);

    // 5. Generate PDF using Puppeteer
    console.log('📄 Generating PDF...');
    
    const pdfBuffer = await generatePdfFromHtml({
      html: fullHtml,
      filename: `report-card-${reportData.member.name}.pdf`,
      format: 'Letter',
      margin: {
        top: '0.75in',
        right: '0.5in',
        bottom: '0.75in',
        left: '0.5in',
      },
    });

    // 6. Return PDF as response
    const filename = `Report-Card-${reportData.member.firstName}-${reportData.member.lastName}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    console.log(`✅ PDF generated successfully: ${filename}`);
    
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('❌ Export PDF error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate PDF report',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

