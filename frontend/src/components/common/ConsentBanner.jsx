import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Dialog, DialogActions, DialogContent, Link, Stack, Typography } from '@mui/material';
import { useSettingsStore } from '../../store/settingsStore';
import {
  consentStatus, setConsent, initTracking, trackPageView,
  isTrackingInitialized, CONSENT_REOPEN_EVENT,
} from '../../utils/tracking';

/**
 * Baner zgody na cookies (RODO) w formie modala blokującego stronę.
 * Pokazuje się tylko, gdy skonfigurowano narzędzia analityczne i użytkownik nie podjął jeszcze decyzji.
 * Korzystanie ze strony jest zablokowane (przyciemnione tło, brak zamknięcia ESC/kliknięciem obok),
 * dopóki użytkownik nie wybierze „Akceptuję" albo „Odrzuć". Narzędzia ładują się dopiero po „Akceptuję".
 */
export default function ConsentBanner() {
  const settings = useSettingsStore((s) => s.settings);
  const [status, setStatus] = useState(consentStatus());

  // Link „Ustawienia cookies" w stopce kasuje decyzję i prosi o ponowne pokazanie modala.
  useEffect(() => {
    const reopen = () => setStatus(null);
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

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
    // Jeśli klient wcześniej zaakceptował i skrypty już działają, przeładuj, by je usunąć.
    if (isTrackingInitialized()) window.location.reload();
  };

  return (
    <Dialog
      open
      disableEscapeKeyDown
      // Brak onClose → kliknięcie w tło ani ESC nie zamykają. Decyzja możliwa tylko przyciskami.
      maxWidth="sm"
      fullWidth
      aria-labelledby="cookie-consent-title"
    >
      <DialogContent>
        <Typography id="cookie-consent-title" variant="h6" gutterBottom>
          Szanujemy Twoją prywatność 🍪
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Zanim przejdziesz dalej — używamy plików cookies i narzędzi analityczno-marketingowych
          (m.in. Google, Meta), aby ulepszać stronę i dopasować przekaz. Możesz to zaakceptować lub
          odrzucić; w obu przypadkach normalnie skorzystasz ze strony. Szczegóły w{' '}
          <Link component={RouterLink} to="/polityka-prywatnosci" target="_blank" rel="noreferrer">
            polityce prywatności
          </Link>
          .
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
          <Button fullWidth variant="outlined" color="inherit" onClick={reject}>
            Odrzuć
          </Button>
          <Button fullWidth variant="contained" onClick={accept}>
            Akceptuję
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
