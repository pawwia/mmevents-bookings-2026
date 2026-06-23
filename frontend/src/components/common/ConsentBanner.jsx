import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Paper, Stack, Typography } from '@mui/material';
import { useSettingsStore } from '../../store/settingsStore';
import { consentStatus, setConsent, initTracking, trackPageView } from '../../utils/tracking';

/**
 * Baner zgody na cookies (RODO). Pokazuje się tylko, gdy skonfigurowano narzędzia analityczne
 * i użytkownik nie podjął jeszcze decyzji. Narzędzia ładują się dopiero po „Akceptuję".
 */
export default function ConsentBanner() {
  const settings = useSettingsStore((s) => s.settings);
  const [status, setStatus] = useState(consentStatus());

  const hasTools = !!(
    settings['analytics.gtm_id'] ||
    settings['analytics.ga_measurement_id'] ||
    settings['analytics.fb_pixel_id']
  );
  if (!hasTools || status) return null; // brak narzędzi lub decyzja już podjęta

  const accept = () => {
    setConsent(true);
    initTracking(settings);
    trackPageView(window.location.pathname + window.location.search);
    setStatus('granted');
  };
  const reject = () => {
    setConsent(false);
    setStatus('denied');
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: { xs: 8, sm: 16 },
        left: { xs: 8, sm: 16 },
        right: { xs: 8, sm: 16 },
        maxWidth: 720,
        mx: 'auto',
        p: 2,
        zIndex: (t) => t.zIndex.snackbar,
        borderRadius: 2,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Szanujemy Twoją prywatność 🍪
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Używamy plików cookies i narzędzi analityczno-marketingowych (m.in. Google, Meta), aby
            ulepszać stronę i dopasować przekaz. Możesz zaakceptować lub odrzucić. Szczegóły w{' '}
            <Link component={RouterLink} to="/polityka-prywatnosci" target="_blank" rel="noreferrer">
              polityce prywatności
            </Link>
            .
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button variant="outlined" color="inherit" onClick={reject}>
            Odrzuć
          </Button>
          <Button variant="contained" onClick={accept}>
            Akceptuję
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
