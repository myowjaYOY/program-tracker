export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface SurveyResponse {
  date: string;
  survey_name: string;
  question: string;
  answer: string;
}

export interface ProviderNote {
  date: string;
  note_type: string;
  content: string;
}

export interface MemberContext {
  data_disclaimer: string;
  time_period: string;
  survey_data: SurveyResponse[];
  provider_notes: ProviderNote[];
  data_summary: {
    survey_session_count: number;
    question_count: number;
    note_count: number;
    date_range: {
      start: string;
      end: string;
    };
    data_size_kb: number;
  };
}

export type AIProvider = 'openai' | 'anthropic';

export interface ChatRequest {
  member_id: number;
  message: string;
  conversation_history: ChatMessage[];
  ai_provider: AIProvider;
  context_days: number;
  
  // Optional file upload data
  file_data?: string; // Extracted text from PDF
  file_type?: string; // MIME type (e.g., 'application/pdf')
  file_name?: string; // Original filename for display
}

export interface ResponseMetadata {
  provider: AIProvider;
  model: string;
  data_size_kb: number;
  response_time_ms: number;
  tokens_used: {
    input: number;
    output: number;
  };
  cost_estimate: number;
}

export interface ChatResponse {
  response: string;
  metadata: ResponseMetadata;
}
