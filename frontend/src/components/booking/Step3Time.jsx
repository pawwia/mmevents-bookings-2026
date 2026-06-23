import { useState } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { api } from '../../api/client';
import { useBookingWizard } from '../../store/bookingWizardStore';
import WizardNav from './WizardNav';

/** KROK 3 — dowolna godzina startu. Wstępna analiza wykonalności przy zajętym dniu. */
export default function Step3Time() {
  const { startTime, eventDate, pkg, availability, venue, set, next } = useBookingWizard();
  const [checking, setChecking] = useState(false);
  const [feasibility, setFeasibility] = useState(null);

  const handleNext = async () => {
    if (!availability || availability.available) {
      next();
      return;
    }
    // Dzień zajęty — system próbuje ocenić, czy druga realizacja jest możliwa.
    setChecking(true);
    try {
      const { data } = await api.post('/availability/feasibility', {
        date: eventDate,
        start_time: startTime,
        duration_hours: pkg?.duration_hours,
        venue_address: venue?.address || null,
      });
      setFeasibility(data);
      set({ feasibility: data });
    } catch {
      set({ feasibility: null });
    } finally {
      setChecking(false);
      next();
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        O której godzinie zaczynamy?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Możesz wybrać dowolną godzinę — fotolustro rozstawiamy ok. godziny przed startem.
      </Typography>
      <Stack alignItems="center" spacing={2}>
        <TimePicker
          label="Godzina rozpoczęcia"
          ampm={false}
          value={dayjs(`2000-01-01T${startTime}`)}
          onChange={(value) => value && set({ startTime: value.format('HH:mm') })}
        />
        {pkg && (
          <Alert severity="info" sx={{ width: '100%' }}>
            {pkg.name}: zabawa od {startTime} przez {Number(pkg.duration_hours)} h.
          </Alert>
        )}
        {availability && !availability.available && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            W tym dniu mamy już realizację ({availability.windows.map((w) => `${w.from}–${w.to}`).join(', ')}).
            Twoja rezerwacja zostanie złożona jako zapytanie i potwierdzimy ją ręcznie.
          </Alert>
        )}
      </Stack>
      <WizardNav nextDisabled={!startTime || checking} onNext={handleNext} nextLabel={checking ? 'Sprawdzam…' : 'Dalej'} />
    </Box>
  );
}
