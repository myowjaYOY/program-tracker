import { Box, SvgIcon } from '@mui/material';
import { Hub } from '@mui/icons-material';

interface LogoProps {
  size?: number;
  color?: string;
}

export function Logo({ size = 120, color = 'white' }: LogoProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${color}`,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <SvgIcon
        component={Hub}
        sx={{
          fontSize: size * 0.5,
          color: color,
        }}
      />
    </Box>
  );
}
