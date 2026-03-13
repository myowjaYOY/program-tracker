'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Container } from '@mui/material';
import { Logo } from '@/components/ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

// Array of login images from public/logonPics folder - must match actual files in public/logonPics
const LOGIN_IMAGES = [
  '/logonPics/Camilla.jpg',
  '/logonPics/DNice.jpg',
  '/logonPics/eva.jpg',
  '/logonPics/james.jpg',
  '/logonPics/Jen.jpg',
  '/logonPics/kami.jpg',
  '/logonPics/Ken.jpg',
  '/logonPics/Leanora.jpg',
  '/logonPics/Manuel.jpg',
  '/logonPics/Tara.jpg',
];

const FALLBACK_IMAGE = '/logonPics/Camilla.jpg';

function getRandomImage(): string {
  const randomIndex = Math.floor(Math.random() * LOGIN_IMAGES.length);
  return LOGIN_IMAGES[randomIndex] ?? FALLBACK_IMAGE;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const [randomImage, setRandomImage] = useState<string>(FALLBACK_IMAGE);

  useEffect(() => {
    setRandomImage(getRandomImage());
  }, []);

  const handleImageError = useCallback(() => {
    setRandomImage(FALLBACK_IMAGE);
  }, []);

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

      {/* Right side - Random Image */}
      <Box
        sx={{
          flex: { xs: '0 0 100%', md: '0 0 58.333333%' },
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'grey.200',
          minHeight: '100%',
        }}
      >
        <img
          src={randomImage}
          alt=""
          onError={handleImageError}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      </Box>
    </Box>
  );
}
