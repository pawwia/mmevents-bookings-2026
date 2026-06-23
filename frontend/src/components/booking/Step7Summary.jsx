import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Divider, FormControlLabel, Link, MenuItem, Stack,
  TextField, Typography, CircularProgress,
} from '@mui/material';
import { api, apiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useBookingWizard } from '../../store/bookingWizardStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatPrice, formatDate, EVENT_TYPES } from '../../utils/format';
import { trackPurchase } from '../../utils/tracking';
import WizardNav from './WizardNav';

function Row({ label, value, strong = false, color }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant={strong ? 'subtitle1' : 'body2'} sx={{ fontWeight: strong ? 800 : 400 }} color={color}>
        {label}
      </Typography>
      <Typography variant={strong ? 'subtitle1' : 'body2'} sx={{ fontWeight: strong ? 800 : 600 }} color={color}>
        {value}
      </Typography>
    </Stack>
  );
}

/** KROK 7 — podsumowanie: pełna wycena + kod rabatowy. KROK 8 uruchamiany przyciskiem. */
export default function Step7Summary() {
  const wizard = useBookingWizard();
  const { eventDate, pkg, startTime, venue, client, guestbook, discountCode, quote, set, next } = wizard;
  const { token } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeInput, setCodeInput] = useState(discountCode);
  const [eventType, setEventType] = useState('wesele');
  const [guestsCount, setGuestsCount] = useState('');
  const [consents, setConsents] = useState({ terms: false, pricing: false });

  const maxGuests = Number(settings['booking.max_guests_standard'] || 200);
  const privacyUrl = settings['app.privacy_url'] || '/polityka-prywatnosci';
  const termsUrl = settings['app.terms_url'] || '/regulamin';

  // Wycena indywidualna: typ inny niż wesele/urodziny, powyżej limitu osób lub klient firmowy
  const isStandardType = EVENT_TYPES.find((t) => t.value === eventType)?.standard ?? false;
  const individualQuote =
    !isStandardType || (guestsCount !== '' && Number(guestsCount) > maxGuests) || client?.type === 'company';

  const fetchQuote = useCallback(
    async (code) => {
      try {
        const { data } = await api.post('/quote', {
          package_id: pkg.id,
          event_date: eventDate,
          distance_km: venue.distance_km,
          guestbook,
          discount_code: code || null,
        });
        set({ quote: data, discountCode: code || '' });
        setError(data.discount_error || '');
      } catch (e) {
        setError(apiError(e));
      }
    },
    [pkg, eventDate, venue, guestbook, set]
  );

  useEffect(() => {
    fetchQuote(discountCode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitBooking = async () => {
    // Konto powstaje już w kroku „Twoje dane" — tutaj klient jest zawsze zalogowany.
    if (!token) {
      setError('Sesja wygasła — wróć do kroku „Twoje dane" i zaloguj się ponownie.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/bookings', {
        event_date: eventDate,
        start_time: startTime,
        package_id: pkg.id,
        event_type: eventType,
        guests_count: Number(guestsCount),
        terms_accepted: consents.terms && consents.pricing,
        venue_name: venue.name,
        venue_address: venue.address,
        venue_place_id: venue.place_id,
        venue_lat: venue.lat,
        venue_lng: venue.lng,
        distance_km: venue.distance_km,
        travel_time_min: venue.duration_min,
        guestbook,
        discount_code: discountCode || null,
        client_notes: client.notes || null,
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone,
        type: client.type,
        street: client.street,
        house_no: client.house_no,
        apartment_no: client.apartment_no,
        postal_code: client.postal_code,
        city: client.city,
        country: client.country,
        company_name: client.company_name,
        nip: client.nip,
        company_address: client.company_address,
        representative: client.representative,
      });
      set({ result: data });
      trackPurchase({ id: data.booking_id, value: data.total_price, currency: 'PLN' });
      next(); // KROK 8 — umowa / potwierdzenie
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!quote)
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Podsumowanie rezerwacji
      </Typography>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Row label="Termin" value={`${formatDate(eventDate)}, start ${startTime}`} />
        <Row label="Pakiet" value={`${pkg.name} (${Number(pkg.duration_hours)} h)`} />
        <Row label="Lokalizacja" value={venue.name || venue.address} />
        <Row label="Klient" value={client.type === 'company' ? client.company_name : `${client.first_name} ${client.last_name}`} />
        <Divider />
        <Row label="Cena pakietu" value={formatPrice(quote.package_price)} />
        <Row
          label={`Transport (${venue.distance_km} km, ${quote.free_km} km gratis)`}
          value={quote.transport_cost > 0 ? formatPrice(quote.transport_cost) : 'w cenie'}
        />
        {guestbook !== 'none' && (
          <Row
            label={`Księga gości (${guestbook === 'standard' ? 'standardowa' : 'personalizowana'})`}
            value={quote.guestbook_price > 0 ? formatPrice(quote.guestbook_price) : 'GRATIS'}
          />
        )}
        {quote.discount_amount > 0 && <Row label="Rabat" value={`−${formatPrice(quote.discount_amount)}`} color="success.main" />}
        <Divider />
        <Row label="Razem" value={formatPrice(quote.total_price)} strong />
        <Row label={`Zadatek (${Number(quote.deposit_percent)}%)`} value={formatPrice(quote.deposit_amount)} color="primary.dark" />
      </Stack>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Rodzaj imprezy
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 1.5 }}>
        <TextField
          select
          label="Typ imprezy"
          size="small"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {EVENT_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Przewidywana liczba osób"
          size="small"
          type="number"
          value={guestsCount}
          onChange={(e) => setGuestsCount(e.target.value)}
          inputProps={{ min: 1 }}
          sx={{ minWidth: 220 }}
        />
      </Stack>
      <Alert severity={individualQuote ? 'warning' : 'info'} sx={{ mb: 2 }}>
        {individualQuote ? (
          <>
            Ta impreza podlega <strong>wycenie indywidualnej</strong> (imprezy firmowe, studniówki,
            plenerowe, bale, masowe oraz powyżej {maxGuests} osób). Możesz złożyć rezerwację — w ciągu{' '}
            <strong>24 godzin</strong> przygotujemy spersonalizowaną ofertę. Możesz też napisać:{' '}
            <Link href="mailto:kontakt@mmevents.pl">kontakt@mmevents.pl</Link>.
          </>
        ) : (
          <>Ceny pakietów dotyczą wesel i urodzin do {maxGuests} osób (klienci indywidualni).</>
        )}
      </Alert>

      <Stack direction="row" spacing={1} sx={{ my: 2 }}>
        <TextField
          label="Kod rabatowy"
          size="small"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
        />
        <Button variant="outlined" onClick={() => fetchQuote(codeInput)}>
          Zastosuj
        </Button>
      </Stack>

      <Divider sx={{ my: 2 }} />
      <FormControlLabel
        control={<Checkbox checked={consents.terms} onChange={(e) => setConsents((c) => ({ ...c, terms: e.target.checked }))} />}
        label={
          <Typography variant="body2">
            Wyrażam zgodę na{' '}
            <Link href={privacyUrl} target="_blank" rel="noreferrer">
              politykę prywatności
            </Link>{' '}
            i akceptuję{' '}
            <Link href={termsUrl} target="_blank" rel="noreferrer">
              regulamin
            </Link>
            . *
          </Typography>
        }
      />
      <FormControlLabel
        control={<Checkbox checked={consents.pricing} onChange={(e) => setConsents((c) => ({ ...c, pricing: e.target.checked }))} />}
        label={
          <Typography variant="body2">
            Rozumiem, że obliczona cena zostanie jeszcze zweryfikowana, a imprezy podlegające wycenie
            indywidualnej otrzymają ofertę w ciągu 24 godzin. *
          </Typography>
        }
      />

      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}

      <WizardNav
        onNext={submitBooking}
        nextDisabled={submitting || !consents.terms || !consents.pricing || guestsCount === ''}
        nextLabel={
          submitting ? 'Przetwarzanie…' : individualQuote ? 'Wyślij zapytanie o ofertę' : 'Rezerwuję i generuję umowę'
        }
      />
    </Box>
  );
}
