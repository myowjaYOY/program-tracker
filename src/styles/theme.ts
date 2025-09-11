import { createTheme } from '@mui/material/styles';

const purpleHeart = {
  50: '#f5f2ff',
  100: '#eee6ff',
  200: '#dfd1ff',
  300: '#c8acff',
  400: '#ae7dff',
  500: '#9849ff',
  600: '#8e24ff',
  700: '#8012ef',
  800: '#7510da',
  900: '#5a0ea4',
  950: '#37066f',
};

export const theme = createTheme({
  palette: {
    primary: {
      main: purpleHeart[600], // '#8e24ff'
      light: purpleHeart[400], // '#ae7dff'
      dark: purpleHeart[800], // '#7510da'
    },
    secondary: {
      main: purpleHeart[900], // '#5a0ea4'
      light: purpleHeart[500], // '#9849ff'
      dark: purpleHeart[950], // '#37066f'
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: purpleHeart[600],
        },
      },
    },
  },
});
