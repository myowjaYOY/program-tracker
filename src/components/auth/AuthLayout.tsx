'use client';

import { Box, Container } from '@mui/material';
import { Logo } from '@/components/ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left side - Form */}
      <Box
        sx={{
          flex: { xs: '1 1 100%', md: '0 0 41.666667%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          p: 3,
        }}
      >
        <Container maxWidth="sm">{children}</Container>
      </Box>

      {/* Right side - Branding */}
      <Box
        sx={{
          flex: { xs: '0 0 100%', md: '0 0 58.333333%' },
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8e24ff 0%, #5a0ea4 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.05) 0%, transparent 50%)
            `,
            pointerEvents: 'none',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'white',
            zIndex: 1,
            position: 'relative',
          }}
        >
          <Logo size={150} color="white" />
          <Box sx={{ mt: 4 }}>
            <Box
              component="h1"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700,
                mb: 2,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              Program Tracker
            </Box>
            <Box
              component="p"
              sx={{
                fontSize: { xs: '1rem', md: '1.25rem' },
                opacity: 0.9,
                maxWidth: 400,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              Track your marketing campaigns, leads, and sales with precision
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
