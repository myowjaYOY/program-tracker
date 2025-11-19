import { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ChatMessage, ChatRequest, ChatResponse, AIProvider, ResponseMetadata } from '@/types/ai-chat.types';
import toast from 'react-hot-toast';

interface UseMemberAIChatProps {
  memberId: number;
  contextDays?: number;
}

export function useMemberAIChat({ memberId, contextDays = 90 }: UseMemberAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionMetadata, setSessionMetadata] = useState<ResponseMetadata[]>([]);

  const chatMutation = useMutation<ChatResponse, Error, ChatRequest>({
    mutationFn: async (requestData: ChatRequest) => {
      const response = await fetch('/api/member-ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const error: any = new Error(errorData.error || 'Failed to get AI response');
        error.status = response.status;
        error.provider = requestData.ai_provider;
        throw error;
      }

      return response.json();
    },
    onMutate: async (newRequest: ChatRequest) => {
      // Optimistically add user message
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: newRequest.message, timestamp: new Date() },
      ]);
    },
    onSuccess: (data: ChatResponse) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, timestamp: new Date() },
      ]);
      setSessionMetadata((prev) => [...prev, data.metadata]);
    },
    onError: (error: any) => {
      console.error('[AI Chat Hook] Error:', error);
      
      // Detect rate limit errors (429)
      if (error.status === 429) {
        const providerName = error.provider === 'openai' ? 'OpenAI' : 'Anthropic';
        toast.error(
          `⚠️ ${providerName} Rate Limit Reached\n\nYou've hit the API usage limit. Please wait 60 seconds and try again, or upgrade your ${providerName} plan for higher limits.`,
          { duration: 8000 }
        );
      } 
      // Detect authentication errors
      else if (error.status === 401 || error.status === 403) {
        toast.error('Authentication Error: Please check your API keys in the environment settings.');
      }
      // Detect server errors
      else if (error.status >= 500) {
        toast.error('Server Error: The AI service is temporarily unavailable. Please try again in a moment.');
      }
      // Generic errors
      else {
        toast.error(`AI Error: ${error.message || 'Failed to get AI response'}`);
      }
      
      // Remove the last user message if the AI failed to respond
      setMessages((prev) => prev.slice(0, prev.length - 1));
    },
  });

  const sendMessage = useCallback(
    async (message: string, aiProvider: AIProvider, fileData?: string, fileName?: string) => {
      if (!memberId) {
        toast.error('Please select a member first.');
        return;
      }

      const request: ChatRequest = {
        member_id: memberId,
        message,
        conversation_history: messages.filter((msg) => msg.role !== 'system'),
        ai_provider: aiProvider,
        context_days: contextDays,
        ...(fileData && fileName && {
          file_data: fileData,
          file_name: fileName,
          file_type: 'application/pdf',
        }),
      };
      await chatMutation.mutateAsync(request);
    },
    [memberId, messages, contextDays, chatMutation]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setSessionMetadata([]);
  }, []);

  const totalDataSize = useMemo(() => {
    return sessionMetadata.reduce((sum, meta) => sum + meta.data_size_kb, 0);
  }, [sessionMetadata]);

  const averageResponseTime = useMemo(() => {
    if (sessionMetadata.length === 0) return 0;
    return sessionMetadata.reduce((sum, meta) => sum + meta.response_time_ms, 0) / sessionMetadata.length;
  }, [sessionMetadata]);

  const totalCost = useMemo(() => {
    return sessionMetadata.reduce((sum, meta) => sum + meta.cost_estimate, 0);
  }, [sessionMetadata]);

  const providerUsage = useMemo(() => {
    const usage: { [key in AIProvider]?: { count: number; totalTime: number; totalCost: number } } = {};
    sessionMetadata.forEach((meta) => {
      if (!usage[meta.provider]) {
        usage[meta.provider] = { count: 0, totalTime: 0, totalCost: 0 };
      }
      usage[meta.provider]!.count++;
      usage[meta.provider]!.totalTime += meta.response_time_ms;
      usage[meta.provider]!.totalCost += meta.cost_estimate;
    });
    return usage;
  }, [sessionMetadata]);

  return {
    messages,
    sendMessage,
    clearConversation,
    isLoading: chatMutation.isPending,
    error: chatMutation.error,
    totalDataSize,
    averageResponseTime,
    totalCost,
    providerUsage,
    sessionMetadata,
  };
}

