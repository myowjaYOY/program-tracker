import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchMemberContext } from '@/lib/services/member-context-fetcher';
import type { ChatRequest, ChatResponse, ChatMessage } from '@/types/ai-chat.types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Pricing (per 1M tokens)
const PRICING = {
  openai: {
    model: 'gpt-4o',
    input: 2.50,
    output: 10.00,
  },
  anthropic: {
    model: 'claude-sonnet-4-20250514',
    input: 3.00,
    output: 15.00,
  },
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = (await request.json()) as ChatRequest;
    const { member_id, message, conversation_history, ai_provider, context_days, file_data, file_name, file_type } = body;

    // Validate required fields
    if (!member_id || !message || !ai_provider) {
      return NextResponse.json(
        { error: 'Missing required fields: member_id, message, ai_provider' },
        { status: 400 }
      );
    }

    // Check authentication and authorization
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this member (via leads table)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('lead_id')
      .eq('lead_id', member_id)
      .single();

    if (leadError || !lead) {
      console.error(`[AI Chat] Lead access error for member_id ${member_id}:`, leadError);
      return NextResponse.json({ error: 'Forbidden: Member not found or unauthorized access' }, { status: 403 });
    }

    // Fetch member context
    console.log(`[AI Chat] Fetching context for member ${member_id} (${context_days} days)`);
    const memberContext = await fetchMemberContext(member_id, context_days);
    console.log(`[AI Chat] Context fetched: ${memberContext.data_summary.data_size_kb} KB`);

    // Build file context section if file was uploaded
    const fileContextSection = file_data && file_name ? `

========================================
📎 UPLOADED FILE: ${file_name}
========================================

CRITICAL: The user has uploaded a file and wants you to analyze it. This file content takes PRIORITY over the member's historical survey data for this specific question.

FILE CONTENT:
${file_data}

========================================
END OF UPLOADED FILE
========================================

` : '';

    // Build system prompt with member context
    const systemPrompt = `You are a health data analyst assistant specializing in member wellness programs.

CONTEXT:
You have access to comprehensive, anonymized health data for one member over the past ${context_days} days.
Member identifier: [REDACTED] (Do NOT refer to the member by name or any specific ID)
${fileContextSection}
IMPORTANT: All data below is sorted in CHRONOLOGICAL ORDER (oldest to newest). When analyzing trends, the FIRST entries are the EARLIEST data, and the LAST entries are the MOST RECENT data.

DATA PROVIDED:
Survey Responses (${memberContext.data_summary.question_count} questions from ${memberContext.data_summary.survey_session_count} sessions, sorted oldest to newest):
${JSON.stringify(memberContext.survey_data, null, 2)}

Provider Observations (${memberContext.data_summary.note_count} notes, sorted oldest to newest):
${JSON.stringify(memberContext.provider_notes, null, 2)}

YOUR ROLE:
1. ${file_data ? 'PRIORITIZE the uploaded file content for the current question. Use member data for additional context only.' : 'Answer questions about THIS member\'s health data ONLY.'}
2. Base all answers strictly on the provided data.
3. Cite specific dates, survey names, questions, answers, or note types when possible.
4. Identify trends, patterns, and correlations within the data.
5. When analyzing trends, ALWAYS consider the chronological order: compare EARLIER dates (beginning of the data) to LATER dates (end of the data).
6. For example, if Module 11 occurred on Oct 1 and Module 12 occurred on Nov 1, then Module 11 is earlier and Module 12 is later.
7. Make connections between different health domains (e.g., sleep and energy).
8. Be conversational but precise and factual.
9. If data is insufficient to answer a question, state this clearly.
10. Maintain a helpful and professional tone.
11. Do NOT invent information or make assumptions not supported by the data.
12. Do NOT ask follow-up questions. Wait for the user's next prompt.
13. Do NOT refer to yourself as an AI or language model.

RESPONSE STYLE:
- Start with a direct answer.
- Support with specific data points and timeframes.
- If you identify interesting patterns or discrepancies, point them out.
- Keep responses concise and easy to understand.`;

    // Build messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversation_history,
      { role: 'user', content: message },
    ];

    let aiResponse = '';
    let tokensUsed = { input: 0, output: 0 };
    let model = '';

    // Call appropriate AI provider
    if (ai_provider === 'openai') {
      console.log('[AI Chat] Calling OpenAI GPT-4o...');
      
      try {
        const completion = await openai.chat.completions.create({
          model: PRICING.openai.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 1000,
        });

        aiResponse = completion.choices[0]?.message?.content || 'No response generated';
        tokensUsed = {
          input: completion.usage?.prompt_tokens || 0,
          output: completion.usage?.completion_tokens || 0,
        };
        model = completion.model;
      } catch (openaiError: any) {
        console.error('[AI Chat] OpenAI API Error:', {
          message: openaiError.message,
          status: openaiError.status,
          error: openaiError.error,
        });
        
        // Preserve the error type and status code
        const error: any = new Error(
          openaiError.message || 
          openaiError.error?.message || 
          'OpenAI API Error'
        );
        error.status = openaiError.status || 500;
        error.type = openaiError.error?.type || 'api_error';
        throw error;
      }
    } else if (ai_provider === 'anthropic') {
      console.log('[AI Chat] Calling Anthropic Claude...');
      console.log('[AI Chat] Anthropic API key exists:', !!process.env.ANTHROPIC_API_KEY);
      console.log('[AI Chat] Model:', PRICING.anthropic.model);
      
      // Anthropic requires system message separately
      const systemContent = messages.find((m) => m.role === 'system')?.content || '';
      const conversationMessages = messages.filter((m) => m.role !== 'system');

      try {
        const completion = await anthropic.messages.create({
          model: PRICING.anthropic.model,
          max_tokens: 1000,
          system: systemContent,
          messages: conversationMessages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        });

        aiResponse = completion.content[0]?.type === 'text' ? completion.content[0].text : 'No response generated';
        tokensUsed = {
          input: completion.usage.input_tokens,
          output: completion.usage.output_tokens,
        };
        model = completion.model;
      } catch (anthropicError: any) {
        console.error('[AI Chat] Anthropic API Error:', {
          message: anthropicError.message,
          status: anthropicError.status,
          error: anthropicError.error,
        });
        
        // Preserve the error type and status code
        const error: any = new Error(
          anthropicError.message || 
          anthropicError.error?.message || 
          'Anthropic API Error'
        );
        error.status = anthropicError.status || 500;
        error.type = anthropicError.error?.type || 'api_error';
        throw error;
      }
    } else {
      return NextResponse.json({ error: 'Invalid AI provider' }, { status: 400 });
    }

    // Calculate metrics
    const responseTime = Date.now() - startTime;
    const pricing = PRICING[ai_provider];
    const costEstimate =
      (tokensUsed.input / 1_000_000) * pricing.input +
      (tokensUsed.output / 1_000_000) * pricing.output;

    const response: ChatResponse = {
      response: aiResponse,
      metadata: {
        provider: ai_provider,
        model,
        data_size_kb: memberContext.data_summary.data_size_kb,
        response_time_ms: responseTime,
        tokens_used: tokensUsed,
        cost_estimate: parseFloat(costEstimate.toFixed(4)),
      },
    };

    console.log(
      `[AI Chat] Response generated: ${responseTime}ms, ${tokensUsed.input + tokensUsed.output} tokens, $${costEstimate.toFixed(4)}`
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[AI Chat] Error:', error);
    
    // Determine appropriate status code
    const statusCode = error.status || 500;
    
    // For rate limit errors, provide helpful message
    let errorMessage = error.message || 'Internal server error';
    if (statusCode === 429) {
      errorMessage = 'Rate limit exceeded. Please wait a moment and try again, or upgrade your API plan for higher limits.';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

