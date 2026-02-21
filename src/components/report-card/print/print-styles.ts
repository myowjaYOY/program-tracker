export const printStyles = {
  // Theme Tokens
  colors: {
    primary: '#8e24ff',
    primaryGradient: 'linear-gradient(135deg, #8e24ff 0%, #5a0ea4 100%)',
    secondary: '#5a0ea4',
    background: '#f8fafc',
    white: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    success: '#10b981',
    error: '#ef4444',
    border: '#e2e8f0',
  },

  // Master page layout — A4 dimensions (210mm × 297mm ≈ 8.27in × 11.69in)
  page: {
    width: '210mm',
    minHeight: '297mm',
    padding: '10mm',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    '-webkit-print-color-adjust': 'exact',
    'print-color-adjust': 'exact',
    '@media print': {
      margin: 0,
      padding: '10mm',
      '-webkit-print-color-adjust': 'exact',
      'print-color-adjust': 'exact',
    },
    '& *': {
      '-webkit-print-color-adjust': 'exact',
      'print-color-adjust': 'exact',
    }
  },

  // Report header - High Fidelity Gradient
  header: {
    marginBottom: '32px',
    background: 'linear-gradient(135deg, #8e24ff 0%, #5a0ea4 100%)',
    borderRadius: '12px',
    padding: '32px',
    color: '#ffffff',
    boxShadow: '0 4px 16px rgba(142, 36, 255, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerMetadata: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    padding: '12px 18px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    textAlign: 'right' as const,
  },

  // Section titles with purple underline
  section: {
    marginBottom: '32px',
    pageBreakInside: 'avoid' as const,
  },

  sectionTitle: {
    fontWeight: 700,
    fontSize: '24px',
    marginBottom: '24px',
    color: '#8e24ff',
    borderBottom: '3px solid #8e24ff',
    paddingBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  // Cards - 12px radius, specific shadows
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid #e5e7eb',
  },

  cardLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8e24ff',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '8px',
  },

  cardValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#1a1a1a',
    lineHeight: 1,
  },

  // Table styles
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    '& th': {
      padding: '12px',
      textAlign: 'left' as const,
      fontWeight: 600,
      fontSize: '14px',
      backgroundColor: '#f9fafb',
      borderBottom: '1px solid #e5e7eb',
    },
    '& td': {
      padding: '12px',
      fontSize: '13px',
      borderBottom: '1px solid #e5e7eb',
    },
  },

  // Footer
  footer: {
    marginTop: '48px',
    padding: '20px',
    background: 'linear-gradient(135deg, #f3f0ff 0%, #e9d5ff 100%)',
    borderRadius: '12px',
    textAlign: 'center' as const,
  },

  // Page break utilities
  pageBreakBefore: { pageBreakBefore: 'always' as const, paddingTop: '48px' },
  pageBreakAfter: { pageBreakAfter: 'always' as const },
  noPageBreak: { pageBreakInside: 'avoid' as const },
};