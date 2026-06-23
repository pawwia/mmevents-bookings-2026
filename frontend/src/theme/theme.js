import { createTheme } from '@mui/material/styles';

/**
 * Motyw inspirowany Stripe Dashboard: jasny, biel + bardzo jasny i pastelowy róż
 * + delikatne szarości. Kolory główne nadpisywane z CRM (Ustawienia → Wygląd).
 */
export function buildTheme(settings = {}) {
  const primary = settings['appearance.primary_color'] || '#E8AEB7';
  const secondary = settings['appearance.secondary_color'] || '#FDF3F5';

  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: primary, contrastText: '#3D2228' },
      secondary: { main: '#6B7280' },
      background: { default: '#FAFAFB', paper: '#FFFFFF' },
      text: { primary: '#1F2937', secondary: '#6B7280' },
      divider: '#EAECEF',
      pink: { light: secondary, main: primary },
    },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 700 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { border: '1px solid #EAECEF', boxShadow: '0 1px 3px rgba(16,24,40,0.04)' },
        },
        defaultProps: { elevation: 0 },
      },
      MuiButton: {
        styleOverrides: {
          containedPrimary: {
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 2px 6px rgba(232,174,183,0.5)' },
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& th': { background: '#F9FAFB', fontWeight: 600, color: '#6B7280', fontSize: 13 },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  });
}
