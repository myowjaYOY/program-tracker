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
  AttachFile as AttachFileIcon,
  PictureAsPdf as PictureAsPdfIcon,
} from '@mui/icons-material';
import { useMemberAIChat } from '@/lib/hooks/use-member-ai-chat';
import type { AIProvider } from '@/types/ai-chat.types';
import toast from 'react-hot-toast';

// Extend window to include pdfjsLib from CDN
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface AIInsightsTabProps {
  memberId: number;
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  data: string; // Will hold extracted text from PDF
  pageCount?: number; // Number of pages extracted
}

export default function AIInsightsTab({ memberId }: AIInsightsTabProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [aiProvider, setAiProvider] = useState<AIProvider>('anthropic');
  const [showMetrics, setShowMetrics] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Clear conversation and file when member changes
  useEffect(() => {
    clearConversation();
    setUploadedFile(null);
  }, [memberId, clearConversation]);

  const handleSend = async () => {
    if (isLoading) {
      // Stop button clicked - for now, just a placeholder
      // TODO: Implement abort functionality
      console.log('Stop requested');
      return;
    }
    if (inputMessage.trim() && !isLoading) {
      await sendMessage(
        inputMessage, 
        aiProvider,
        uploadedFile?.data,
        uploadedFile?.name
      );
      setInputMessage('');
      setUploadedFile(null); // Clear file after sending
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

  /**
   * Extract text from PDF file using PDF.js (client-side)
   * Uses external worker to avoid webpack bundling issues
   */
  const extractPdfText = async (file: File): Promise<{ text: string; pageCount: number }> => {
    try {
      // Use CDN-hosted PDF.js to avoid webpack issues entirely
      if (!window.pdfjsLib) {
        // Load PDF.js from CDN if not already loaded
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
          script.type = 'module';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        
        // Wait a bit for the module to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const pdfjsLib = window.pdfjsLib;
      
      if (!pdfjsLib) {
        throw new Error('Failed to load PDF.js library from CDN');
      }

      // Configure worker from CDN
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;

      // Limit to 100 pages for performance
      const maxPages = Math.min(pageCount, 100);

      let fullText = '';

      // Extract text from each page
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Combine all text items from the page
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        fullText += pageText + '\n\n';

        // Update progress for large PDFs
        if (pageCount > 10 && i % 5 === 0) {
          console.log(`[PDF Extraction] Processed ${i}/${maxPages} pages`);
        }
      }

      // Truncate if text is too large (> 100,000 characters)
      const maxChars = 100000;
      if (fullText.length > maxChars) {
        console.warn(`[PDF Extraction] Text truncated from ${fullText.length} to ${maxChars} characters`);
        fullText = fullText.substring(0, maxChars) + '\n\n[Text truncated due to length...]';
      }

      return { text: fullText.trim(), pageCount };
    } catch (error: any) {
      console.error('[PDF Extraction] Error:', error);

      // Handle specific errors
      if (error.name === 'PasswordException') {
        throw new Error('This PDF is password-protected. Please unlock it first.');
      }

      throw new Error('Unable to extract text from this PDF. The file may be corrupted or contain only images.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - only PDF
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported. Please select a PDF file.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size - max 5 MB
    const maxSizeInBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSizeInBytes) {
      toast.error(`File too large. Maximum size is 5 MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Start extraction process
    setIsExtractingPdf(true);
    const loadingToast = toast.loading(`Extracting text from ${file.name}...`);

    try {
      // Extract text from PDF
      const { text, pageCount } = await extractPdfText(file);

      // Check if PDF had any text
      if (!text || text.trim().length < 50) {
        toast.dismiss(loadingToast);
        toast.error('This PDF appears to contain no text or only images. Text extraction may be incomplete.', {
          duration: 5000,
        });
        // Still allow upload with limited text
      }

      // Store file with extracted text
      setUploadedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: text,
        pageCount: pageCount,
      });

      toast.dismiss(loadingToast);
      toast.success(`Extracted ${pageCount} page${pageCount !== 1 ? 's' : ''} from ${file.name}`, {
        duration: 3000,
      });

      console.log(`[PDF Upload] Successfully extracted ${text.length} characters from ${pageCount} pages`);
    } catch (error: any) {
      console.error('[PDF Upload] Extraction failed:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to extract text from PDF', {
        duration: 5000,
      });
      
      // Clear file state on error
      setUploadedFile(null);
    } finally {
      setIsExtractingPdf(false);
      
      // Clear the input so the same file can be re-uploaded if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    toast.success('File removed');
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

      {/* File Upload - Hidden Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
        disabled={isLoading || isExtractingPdf}
      />

      {/* File Chip Display - Show above input if file uploaded or extracting */}
      {(uploadedFile || isExtractingPdf) && (
        <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {isExtractingPdf && <CircularProgress size={16} />}
          <Chip
            {...(!isExtractingPdf && { icon: <PictureAsPdfIcon /> })}
            label={
              isExtractingPdf
                ? 'Extracting text...'
                : uploadedFile?.pageCount
                ? `${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(0)} KB) • ${uploadedFile.pageCount} page${uploadedFile.pageCount !== 1 ? 's' : ''}`
                : `${uploadedFile?.name} (${((uploadedFile?.size || 0) / 1024).toFixed(0)} KB)`
            }
            {...(!isExtractingPdf && { onDelete: handleRemoveFile })}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ maxWidth: '100%' }}
          />
        </Box>
      )}

      {/* Message Input with Inline Upload Button */}
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
        <Tooltip title={isExtractingPdf ? "Extracting PDF..." : "Upload PDF"}>
          <span>
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !memberId || isExtractingPdf}
              sx={{
                width: '48px',
                height: '48px',
                color: 'primary.main',
                border: '1px solid',
                borderColor: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.50',
                },
                '&.Mui-disabled': {
                  color: 'action.disabled',
                  borderColor: 'action.disabledBackground',
                },
              }}
            >
              {isExtractingPdf ? <CircularProgress size={20} /> : <AttachFileIcon />}
            </IconButton>
          </span>
        </Tooltip>
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Example: &quot;What patterns can you glean from the entire data set that would not be obvious to me as a provider or to the member?&quot;
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              <PictureAsPdfIcon fontSize="small" />
              You can also upload PDF files to analyze specific documents
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

