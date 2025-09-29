'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material';
import { MemberPrograms } from '@/types/database.types';
import { useActiveLeads } from '@/lib/hooks/use-leads';
import { useActiveProgramStatus } from '@/lib/hooks/use-program-status';
import { useMemberProgramFinances } from '@/lib/hooks/use-member-program-finances';
import { useMemberProgramPayments } from '@/lib/hooks/use-member-program-payments';
import { downloadQuoteFromTemplate } from '@/lib/utils/generate-quote-template';
import { loadTemplate, TEMPLATE_PATHS } from '@/lib/utils/template-loader';
import { toast } from 'sonner';

interface DashboardProgramInfoTabProps {
  program: MemberPrograms;
}

export default function DashboardProgramInfoTab({
  program,
}: DashboardProgramInfoTabProps) {
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);

  const { data: leads = [] } = useActiveLeads();
  const { data: programStatuses = [] } = useActiveProgramStatus();
  const { data: finances } = useMemberProgramFinances(
    program.member_program_id
  );
  const { data: payments = [] } = useMemberProgramPayments(
    program.member_program_id
  );

  // Get the current lead data
  const currentLead = leads.find(lead => lead.lead_id === program.lead_id);
  const currentStatus = programStatuses.find(
    status => status.program_status_id === program.program_status_id
  );

  const handleGenerateQuote = async () => {
    try {
      setIsGeneratingQuote(true);
      
      if (!currentLead) {
        throw new Error('Lead information not found');
      }

      if (!finances) {
        throw new Error('Program financial information not found. Please ensure the program has financial data before generating a quote.');
      }

      // Prepare quote data
      const quoteData = {
        member: {
          name: `${currentLead.first_name || ''} ${currentLead.last_name || ''}`.trim(),
          email: currentLead.email || '',
          phone: currentLead.phone || '',
          address: '', // Address field not available in Leads table
        },
        program: {
          name: program.program_template_name || 'Program',
          description: program.description || 'No description available',
          startDate: program.start_date ? new Date(program.start_date).toLocaleDateString() : 'Not set',
          duration: 'Program duration not specified',
        },
        financials: {
          financeCharges: finances?.finance_charges || 0,
          taxes: finances?.taxes || 0,
          discounts: finances?.discounts || 0,
          finalTotalPrice: finances?.final_total_price || 0,
          margin: finances?.margin || 0,
        },
        payments: (payments || []).map(payment => ({
          paymentId: payment.member_program_payment_id,
          amount: payment.payment_amount || 0,
          dueDate: payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'Not set',
          ...(payment.payment_date && { paymentDate: new Date(payment.payment_date).toLocaleDateString() }),
        })),
        generatedDate: new Date().toLocaleDateString(),
      };

      // Load the template (with fallback)
      let templateBuffer: ArrayBuffer;
      try {
        templateBuffer = await loadTemplate(TEMPLATE_PATHS.QUOTE);
      } catch (templateError) {
        throw new Error(`Template not found. Please ensure ${TEMPLATE_PATHS.QUOTE} exists in the public/templates directory. ${templateError instanceof Error ? templateError.message : ''}`);
      }
      
      // Generate and download the document from template
      await downloadQuoteFromTemplate(quoteData, templateBuffer);
      toast.success('Quote document generated successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to generate quote: ${errorMessage}`);
      console.error('Quote generation error:', error);
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Column 1: Program Name, Member, Status, Start Date */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
            {/* Program Name */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Program Name
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                {program.program_template_name || 'No name set'}
              </Typography>
            </Box>

            {/* Member */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Member
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {currentLead 
                  ? `${currentLead.first_name} ${currentLead.last_name}`.trim()
                  : 'No member assigned'
                }
              </Typography>
              {currentLead?.email && (
                <Typography variant="body2" color="text.secondary">
                  {currentLead.email}
                </Typography>
              )}
            </Box>

            {/* Status */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Status
              </Typography>
              <Chip
                label={currentStatus?.status_name || 'Unknown'}
                color={
                  currentStatus?.status_name?.toLowerCase() === 'active'
                    ? 'success'
                    : currentStatus?.status_name?.toLowerCase() === 'paused'
                    ? 'warning'
                    : currentStatus?.status_name?.toLowerCase() === 'completed'
                    ? 'info'
                    : 'default'
                }
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            </Box>

            {/* Start Date */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Start Date
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {program.start_date 
                  ? new Date(program.start_date).toLocaleDateString()
                  : 'Not set'
                }
              </Typography>
            </Box>
          </Box>

          {/* Column 2: Active Flag, Description */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
          >
            {/* Active Flag */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Active Flag
              </Typography>
              <Chip
                label={program.active_flag ? 'Active' : 'Inactive'}
                color={program.active_flag ? 'success' : 'default'}
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            </Box>

            {/* Description */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Member Goals
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontWeight: 500,
                  minHeight: '120px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {program.description || 'No goals specified'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Action Buttons Row - Readonly version */}
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Quote Button - Keep for readonly viewing */}
          <Button
            variant="outlined"
            disabled={program.status_name?.toLowerCase() !== 'quote' || isGeneratingQuote}
            sx={{ 
              minWidth: 100,
              borderRadius: 0,
            }}
            onClick={handleGenerateQuote}
            startIcon={isGeneratingQuote ? <CircularProgress size={16} /> : undefined}
          >
            {isGeneratingQuote ? 'Generating...' : 'Quote'}
          </Button>
          
          {/* Contract Button - Keep for readonly viewing */}
          <Button
            variant="outlined"
            disabled={program.status_name?.toLowerCase() !== 'quote'}
            sx={{ 
              minWidth: 100,
              borderRadius: 0,
            }}
            onClick={() => {
              // TODO: Implement Contract functionality for readonly view
              console.log('Contract button clicked (readonly mode)');
            }}
          >
            Contract
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
