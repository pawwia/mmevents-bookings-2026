import { useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, CircularProgress, TextField, Typography, Paper, Stack } from '@mui/material';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import { api, apiError } from '../../api/client';
import { useBookingWizard } from '../../store/bookingWizardStore';
import { formatPrice } from '../../utils/format';
import WizardNav from './WizardNav';

/** KROK 4 — lokalizacja: Google Places autocomplete + dystans od siedziby (Distance Matrix). */
export default function Step4Location() {
  const { venue, pkg, set } = useBookingWizard();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounce = useRef(null);
  const sessionToken = useMemo(() => crypto.randomUUID(), []);

  const search = (query) => {
    clearTimeout(debounce.current);
    if (query.length < 3) return setOptions([]);
    debounce.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/places/autocomplete', { params: { q: query, session: sessionToken } });
        setOptions(data);
      } catch (e) {
        setError(apiError(e));
      }
    }, 350);
  };

  const selectPlace = async (option) => {
    if (!option) return set({ venue: null });
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/places/details', { params: { place_id: option.place_id } });
      set({
        venue: {
          place_id: option.place_id,
          name: data.name,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          distance_km: data.distance_km, // km do rozliczenia (od granicy Szczecina)
          duration_min: data.duration_min,
          in_free_city: data.in_free_city,
          raw_distance_km: data.raw_distance_km,
        },
      });
    } catch (e) {
      set({ venue: null });
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const extraKm = venue && pkg ? Math.max(0, venue.distance_km - pkg.free_km) : 0;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Gdzie odbywa się impreza?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Wpisz nazwę obiektu (np. sala weselna) lub adres — Google podpowie lokalizację.
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Obsługujemy województwa <strong>zachodniopomorskie i lubuskie</strong>. Dojazd na terenie
        Szczecina jest <strong>gratis w każdym pakiecie</strong> — kilometry liczymy dopiero od granicy miasta.
      </Alert>
      <Autocomplete
        options={options}
        filterOptions={(x) => x}
        getOptionLabel={(o) => o.description || ''}
        isOptionEqualToValue={(o, v) => o.place_id === v.place_id}
        onInputChange={(_, value) => search(value)}
        onChange={(_, option) => selectPlace(option)}
        noOptionsText="Wpisz min. 3 znaki…"
        renderInput={(params) => <TextField {...params} label="Nazwa obiektu lub adres" fullWidth />}
        renderOption={(props, option) => (
          <li {...props} key={option.place_id}>
            <PlaceIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <span>
              <strong>{option.main_text}</strong>
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {option.secondary_text}
              </Typography>
            </span>
          </li>
        )}
      />
      {loading && (
        <Box sx={{ textAlign: 'center', my: 2 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {venue && (
        <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'pink.light' }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">{venue.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {venue.address}
            </Typography>
            {venue.in_free_city ? (
              <Typography variant="body2">
                <strong>Impreza w Szczecinie — dojazd gratis w każdym pakiecie 🎉</strong>
              </Typography>
            ) : (
              <Typography variant="body2">
                Kilometry od granicy Szczecina: <strong>{venue.distance_km} km</strong> (dojazd ok.{' '}
                {venue.duration_min} min)
              </Typography>
            )}
            {pkg && !venue.in_free_city && (
              <Typography variant="body2">
                {extraKm > 0 ? (
                  <>
                    Transport: {pkg.free_km} km gratis w pakiecie, dopłata za {extraKm.toFixed(1)} km ≈{' '}
                    <strong>{formatPrice(extraKm * 1.6)}</strong>
                  </>
                ) : (
                  <strong>Transport w cenie pakietu 🎉</strong>
                )}
              </Typography>
            )}
          </Stack>
        </Paper>
      )}
      <WizardNav nextDisabled={!venue} />
    </Box>
  );
}
