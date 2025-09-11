import { Box, Typography } from '@mui/material';

export default function Logo() {
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'primary.main',
        borderRadius: 1,
        color: 'white',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: '0.75rem',
          lineHeight: 1,
        }}
      >
        PT
      </Typography>
    </Box>
  );
}
