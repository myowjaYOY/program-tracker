import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type {
  ClinicalActionPlan,
  MsqAssessmentSummary,
  MsqDomainCard,
} from '@/types/database.types';

/**
 * GET /api/report-card/clinical-plan/:memberId
 * 
 * Returns AI-generated clinical action plan and progress monitoring recommendations.
 * 
 * Uses OpenAI GPT-4o-mini to analyze MSQ assessment data and generate:
 * - 4 Action Plan cards (Dietary Intervention, Testing, Lifestyle, Follow-up)
 * - 4 Progress Monitoring cards (Success Indicators, Red Flags, Education, Outcomes)
 * 
 * @param memberId - external_user_id from survey_user_mappings
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await context.params;

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json(
        {
          error: 'AI features not configured',
          message:
            'OpenAI API key is missing. Please add OPENAI_API_KEY to your .env.local file.',
        },
        { status: 503 }
      );
    }

    // Fetch the full assessment data
    const baseUrl = request.nextUrl.origin;
    const assessmentResponse = await fetch(
      `${baseUrl}/api/report-card/msq-assessment/${memberId}`,
      {
        headers: {
          Cookie: request.headers.get('Cookie') || '',
        },
      }
    );

    if (!assessmentResponse.ok) {
      const error = await assessmentResponse.json();
      return NextResponse.json(
        { error: error.error || 'Failed to fetch assessment data' },
        { status: assessmentResponse.status }
      );
    }

    const assessmentData = await assessmentResponse.json();
    const summary: MsqAssessmentSummary = assessmentData.data.summary;
    const domains: MsqDomainCard[] = assessmentData.data.domains;

    // Build the prompt for OpenAI
    const prompt = buildClinicalPlanPrompt(summary, domains);

    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a clinical nutritionist and functional medicine practitioner specializing in MSQ-95 (Medical Symptoms Questionnaire) analysis. Generate evidence-based, personalized clinical recommendations based on symptom patterns.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const aiResponse = JSON.parse(responseContent);

    // Structure the response
    const clinicalPlan: ClinicalActionPlan = {
      action_plan: aiResponse.action_plan || [],
      progress_monitoring: aiResponse.progress_monitoring || [],
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json({
      data: clinicalPlan,
    });
  } catch (error) {
    console.error('Clinical Plan API error:', error);

    // Check for OpenAI-specific errors
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        {
          error: 'AI service error',
          message: error.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildClinicalPlanPrompt(
  summary: MsqAssessmentSummary,
  domains: MsqDomainCard[]
): string {
  const topDomains = domains
    .filter(d => d.average_score > 0)
    .sort((a, b) => b.average_score - a.average_score)
    .slice(0, 3)
    .map(
      d =>
        `${d.domain_label} (avg score: ${d.average_score}, trend: ${d.trend})`
    )
    .join(', ');

  const improvingDomains = domains
    .filter(d => d.trend === 'improving')
    .map(d => d.domain_label)
    .join(', ');

  const worseningDomains = domains
    .filter(d => d.trend === 'worsening')
    .map(d => d.domain_label)
    .join(', ');

  const prompt = `
Patient: ${summary.member_name}
Assessment Period: ${summary.period_start} to ${summary.period_end}
Total MSQ Score: ${summary.total_msq_score}
Active Symptoms: ${summary.active_symptoms} / ${summary.total_symptoms_count}

Top Problem Areas: ${topDomains || 'None significant'}
Improving: ${improvingDomains || 'None'}
Worsening: ${worseningDomains || 'None'}

Clinical Alerts:
${summary.clinical_alerts.map(a => `- ${a.title}: ${a.message}`).join('\n')}

Generate a JSON response with the following structure:
{
  "action_plan": [
    {
      "type": "dietary",
      "title": "Dietary Intervention",
      "description": "Specific dietary recommendations based on symptom patterns"
    },
    {
      "type": "testing",
      "title": "Recommended Testing",
      "description": "Lab tests or assessments recommended"
    },
    {
      "type": "lifestyle",
      "title": "Lifestyle Modifications",
      "description": "Non-dietary interventions (sleep, stress, exercise)"
    },
    {
      "type": "followup",
      "title": "Follow-up Schedule",
      "description": "Timeline for reassessment and monitoring"
    }
  ],
  "progress_monitoring": [
    {
      "type": "dietary",
      "title": "Success Indicators",
      "description": "What positive changes to expect and when"
    },
    {
      "type": "testing",
      "title": "Red Flags",
      "description": "Warning signs that require immediate attention"
    },
    {
      "type": "lifestyle",
      "title": "Patient Education Focus",
      "description": "Key concepts patient should understand"
    },
    {
      "type": "followup",
      "title": "Expected Outcomes",
      "description": "Realistic timeline and goals for improvement"
    }
  ]
}

Be specific, evidence-based, and personalized to this patient's symptom pattern.
`;

  return prompt;
}
