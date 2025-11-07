export const printStyles = {
  // Master page layout
  page: {
    width: '8.5in',
    minHeight: '11in',
    padding: '0.75in 0.5in',
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: 'Arial, sans-serif',
    '@media print': {
      margin: 0,
      padding: 0,
    },
  },

  // Report header
  header: {
    marginBottom: '24px',
    borderBottom: '3px solid #8e24ff',
    paddingBottom: '16px',
  },

  // Section styles
  section: {
    marginBottom: '32px',
    pageBreakInside: 'avoid',
  },

  sectionTitle: {
    fontWeight: 700,
    fontSize: '20px',
    marginBottom: '16px',
    color: '#8e24ff',
    borderBottom: '2px solid #8e24ff',
    paddingBottom: '8px',
  },

  subsection: {
    marginBottom: '24px',
    pageBreakInside: 'avoid',
  },

  subsectionTitle: {
    fontWeight: 600,
    fontSize: '16px',
    marginBottom: '12px',
    color: '#333333',
  },

  // Data display
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },

  dataItem: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    borderLeft: '3px solid #8e24ff',
  },

  label: {
    fontSize: '12px',
    color: '#666666',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },

  value: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#333333',
  },

  // Table styles
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '16px',
    '& thead': {
      backgroundColor: '#f5f5f5',
    },
    '& th': {
      padding: '12px',
      textAlign: 'left' as const,
      fontWeight: 600,
      fontSize: '14px',
      borderBottom: '2px solid #8e24ff',
      color: '#333333',
    },
    '& td': {
      padding: '12px',
      fontSize: '14px',
      borderBottom: '1px solid #e0e0e0',
    },
    '& tbody tr:last-child td': {
      borderBottom: 'none',
    },
  },

  // Footer
  footer: {
    marginTop: '48px',
    paddingTop: '16px',
    borderTop: '1px solid #e0e0e0',
    fontSize: '12px',
    color: '#999999',
    textAlign: 'center' as const,
  },

  // Page break utilities
  pageBreakBefore: {
    pageBreakBefore: 'always' as const,
  },

  pageBreakAfter: {
    pageBreakAfter: 'always' as const,
  },

  noPageBreak: {
    pageBreakInside: 'avoid' as const,
  },
};






