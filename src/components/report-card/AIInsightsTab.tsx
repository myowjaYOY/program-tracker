'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Collapse,
  Divider,
  Chip,
} from '@mui/material';
import {
  Send as SendIcon,
  ClearAll as ClearAllIcon,
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ArrowUpward as ArrowUpwardIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { useMemberAIChat } from '@/lib/hooks/use-member-ai-chat';
import type { AIProvider } from '@/types/ai-chat.types';

interface AIInsightsTabProps {
  memberId: number;
}

export default function AIInsightsTab({ memberId }: AIInsightsTabProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [aiProvider, setAiProvider] = useState<AIProvider>('anthropic');
  const [showMetrics, setShowMetrics] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    clearConversation,
    isLoading,
    error,
    totalDataSize,
    averageResponseTime,
    totalCost,
    providerUsage,
    sessionMetadata,
  } = useMemberAIChat({ memberId });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Clear conversation when member changes
  useEffect(() => {
    clearConversation();
  }, [memberId, clearConversation]);

  const handleSend = async () => {
    if (isLoading) {
      // Stop button clicked - for now, just a placeholder
      // TODO: Implement abort functionality
      console.log('Stop requested');
      return;
    }
    if (inputMessage.trim() && !isLoading) {
      await sendMessage(inputMessage, aiProvider);
      setInputMessage('');
    }
  };

  const handleProviderChange = (
    _event: React.MouseEvent<HTMLElement>,
    newProvider: AIProvider | null
  ) => {
    if (newProvider !== null) {
      setAiProvider(newProvider);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messageCount = messages.filter((m) => m.role !== 'system').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', p: 2 }}>
      {/* Hidden AI Provider Selection - Keep functional but invisible */}
      <Box sx={{ display: 'none' }}>
        <ToggleButtonGroup
          value={aiProvider}
          exclusive
          onChange={handleProviderChange}
          aria-label="AI provider selection"
          size="small"
        >
          <ToggleButton value="openai">OpenAI</ToggleButton>
          <ToggleButton value="anthropic">Anthropic</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Message Input - Moved to Top */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          variant="outlined"
          placeholder="Ask a question about this member..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isLoading || !memberId}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1,
            },
          }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!isLoading && (!inputMessage.trim() || !memberId)}
          sx={{
            width: '48px',
            height: '48px',
            bgcolor: isLoading ? 'error.main' : 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: isLoading ? 'error.dark' : 'primary.dark',
            },
            '&.Mui-disabled': {
              bgcolor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          {isLoading ? <StopIcon /> : <ArrowUpwardIcon />}
        </IconButton>
      </Box>

      {/* Session Metrics */}
      {sessionMetadata.length > 0 && (
        <Paper elevation={1} sx={{ mb: 2, bgcolor: 'grey.50' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 1.5,
              cursor: 'pointer',
            }}
            onClick={() => setShowMetrics(!showMetrics)}
          >
            <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
              Session Metrics
            </Typography>
            <IconButton size="small">
              {showMetrics ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={showMetrics}>
            <Divider />
            <Box sx={{ p: 1.5, pt: 1 }}>
              <Typography variant="body2">
                📊 Context Data Size: <strong>{totalDataSize.toFixed(2)} KB</strong>
              </Typography>
              <Typography variant="body2">
                💬 Messages Sent: <strong>{messageCount / 2}</strong>
              </Typography>
              <Typography variant="body2">
                ⏱️ Avg Response Time: <strong>{averageResponseTime.toFixed(0)} ms</strong>
              </Typography>
              {Object.entries(providerUsage).map(([provider, usage]) => (
                <Typography variant="body2" key={provider}>
                  🤖 {provider === 'openai' ? 'OpenAI' : 'Anthropic'}: <strong>{usage.count} times</strong> (Avg{' '}
                  {(usage.totalTime / usage.count).toFixed(0)}ms, ${(usage.totalCost / usage.count).toFixed(4)})
                </Typography>
              ))}
              <Typography variant="body2" fontWeight="bold" sx={{ mt: 1, color: 'primary.main' }}>
                💰 Total Estimated Cost: ${totalCost.toFixed(4)}
              </Typography>
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Chat Display */}
      <Box
        ref={chatContainerRef}
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          mb: 2,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
        }}
      >
        {messageCount === 0 && !isLoading ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 8 }}>
            <PsychologyIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
            <Typography variant="h6" gutterBottom>
              Ask about this member&apos;s health data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Example: &quot;What patterns can you glean from the entire data set that would not be obvious to me as a provider or to the member?&quot;
            </Typography>
          </Box>
        ) : (
          messages
            .filter((msg) => msg.role !== 'system')
            .map((msg, index) => {
              const messageIndex = Math.floor(index / 2);
              const metadata = msg.role === 'assistant' ? sessionMetadata[messageIndex] : null;

              return (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    mb: 2,
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      maxWidth: '75%',
                      bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.100',
                      color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {msg.content}
                    </Typography>
                    {metadata && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 1,
                          pt: 1,
                          borderTop: '1px solid',
                          borderColor: 'divider',
                          color: 'text.secondary',
                        }}
                      >
                        🤖 {metadata.model} • ⏱️ {metadata.response_time_ms}ms • 🎫{' '}
                        {metadata.tokens_used.input + metadata.tokens_used.output} tokens • 💰 $
                        {metadata.cost_estimate.toFixed(4)}
                      </Typography>
                    )}
                  </Paper>
                </Box>
              );
            })
        )}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CircularProgress size={20} />
              <Typography variant="body2">Thinking...</Typography>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
}

