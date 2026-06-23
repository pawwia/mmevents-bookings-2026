import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Typography, CircularProgress } from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { api, apiError } from '../../api/client';
import { useBookingWizard } from '../../store/bookingWizardStore';
import { useSettingsStore } from '../../store/settingsStore';
import { trackEventOnce } from '../../utils/tracking';
import Turnstile from '../common/Turnstile';
import WizardNav from './WizardNav';

/**
 * KROK 1 — wybór terminu.
 * Można wybierać tylko dni z lat, na które wprowadzono cennik w CRM (lata „rezerwowalne").
 * Jeśli dzień zajęty: komunikat + możliwość złożenia zapytania.
 */
export default function Step1Date() {
  const { eventDate, availability, set } = useBookingWizard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookableYears, setBookableYears] = useState(null); // null = jeszcze ładowane
  const [cfToken, setCfToken] = useState('');
  const [cfRefresh, setCfRefresh] = useState(0);
  const [pendingDate, setPendingDate] = useState(null); // data oczekująca na token Cloudflare
  const [humanVerified, setHumanVerified] = useState(false); // raz przeszliśmy Turnstile w tej sesji
  const captchaEnabled = useSettingsStore((s) => !!s.settings['security.turnstile_site_key']);

  useEffect(() => {
    api
      .get('/booking-years')
      .then(({ data }) => setBookableYears(data.years || []))
      .catch(() => setBookableYears([]));
  }, []);

  const isYearBookable = (date) => !!bookableYears && bookableYears.includes(date.year());
  const maxDate = bookableYears?.length ? dayjs(`${Math.max(...bookableYears)}-12-31`) : undefined;

  const runCheck = useCallback(
    async (date, token) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/availability', { params: { date, cf_token: token || undefined } });
        set({ availability: data });
        setHumanVerified(true); // serwer zaufał temu IP — kolejne sprawdzenia bez nowego tokenu
        trackEventOnce('CheckAvailability', { available: !!data.available });
      } catch (e) {
        if (e?.response?.status === 403) {
          // Wygasła weryfikacja / brak tokenu → poproś Cloudflare o świeży i ponów po jego przejściu.
          setHumanVerified(false);
          setCfToken('');
          setPendingDate(date);
          setCfRefresh((n) => n + 1);
        } else {
          setError(apiError(e));
        }
      } finally {
        setLoading(false);
      }
    },
    [set]
  );

  const handleSelect = (value) => {
    const date = value.format('YYYY-MM-DD');
    set({ eventDate: date, availability: null });
    setError('');
    // Pierwsze sprawdzenie wymaga przejścia Cloudflare (auto lub ręczne) — czekamy na token.
    if (captchaEnabled && !cfToken && !humanVerified) {
      setPendingDate(date);
      return;
    }
    setPendingDate(null);
    runCheck(date, cfToken);
  };

  // Gdy token przyjdzie (auto lub po ręcznym kliknięciu checkboxa), dokończ oczekujące sprawdzenie.
  useEffect(() => {
    if (cfToken && pendingDate) {
      const date = pendingDate;
      setPendingDate(null);
      runCheck(date, cfToken);
    }
  }, [cfToken, pendingDate, runCheck]);

  const onToken = useCallback((t) => setCfToken(t), []);
  const remaining = availability?.remaining_checks;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Kiedy odbywa się Twoja impreza?
      </Typography>
      {bookableYears && bookableYears.length === 0 && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Rezerwacje online nie są jeszcze otwarte — pracujemy nad cennikiem na nadchodzący sezon.
          Skontaktuj się z nami, a pomożemy dobrać termin.
        </Alert>
      )}
      {bookableYears && bookableYears.length > 0 && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 1 }}>
          Dostępne lata rezerwacji: {bookableYears.join(', ')}
        </Typography>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <DateCalendar
          value={eventDate ? dayjs(eventDate) : null}
          onChange={handleSelect}
          disablePast
          maxDate={maxDate}
          shouldDisableDate={(date) => !isYearBookable(date)}
          disabled={!bookableYears || bookableYears.length === 0}
          sx={{ '& .Mui-selected': { bgcolor: 'primary.main' } }}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Turnstile onToken={onToken} refreshKey={cfRefresh} action="availability" />
      </Box>
      {pendingDate && !loading && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Potwierdź weryfikację Cloudflare powyżej — sprawdzimy wybrany termin automatycznie.
        </Alert>
      )}
      {loading && (
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {typeof remaining === 'number' && remaining <= 5 && remaining > 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Zostało tylko {remaining} {remaining === 1 ? 'sprawdzenie' : 'sprawdzenia/sprawdzeń'} terminu w tej sesji.
        </Alert>
      )}
      {availability && availability.available && (
        <Alert severity="success">Ten termin jest wolny! 🎉 Przejdź dalej, aby wybrać pakiet.</Alert>
      )}
      {availability && !availability.available && (
        <Alert severity={availability.blackout ? 'info' : 'warning'}>
          {availability.message}
        </Alert>
      )}
      <WizardNav
        nextDisabled={
          !eventDate || !availability || availability.year_bookable === false || availability.blackout === true
        }
        nextLabel={
          availability && !availability.available && availability.year_bookable !== false && !availability.blackout
            ? 'Złóż zapytanie'
            : 'Dalej'
        }
      />
    </Box>
  );
}
