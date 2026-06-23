import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Divider, Grid, Paper, Stack, Typography, Link,
} from '@mui/material';
import { api, apiError } from '../../api/client';
import StatusChip from '../../components/common/StatusChip';
import PersonalizationEditor from '../../components/booking/PersonalizationEditor';
import ClientContractSigning from '../../components/client/ClientContractSigning';
import ChatPanel from '../../components/common/ChatPanel';
import { formatDate, formatPrice, formatTime } from '../../utils/format';

function Info({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get(`/bookings/${id}`)
      .then(({ data }) => setBooking(data))
      .catch((e) => setError(apiError(e)));
  }, [id]);

  useEffect(load, [load]);

  const payOnline = async () => {
    try {
      const { data } = await api.post(`/bookings/${id}/paynow`);
      if (data.redirect_url) window.location.href = data.redirect_url;
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!booking)
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );

  const awaitingDeposit = booking.status === 'awaiting_deposit';

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h5">Rezerwacja #{booking.id}</Typography>
        <StatusChip status={booking.status} label={booking.status_label} />
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Szczegóły imprezy
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Info label="Data" value={formatDate(booking.event_date)} />
              </Grid>
              <Grid item xs={6}>
                <Info label="Start" value={formatTime(booking.start_time)} />
              </Grid>
              <Grid item xs={6}>
                <Info label="Pakiet" value={`${booking.package_name} (${Number(booking.duration_hours)} h)`} />
              </Grid>
              <Grid item xs={6}>
                <Info label="Księga gości" value={{ none: 'brak', standard: 'standardowa', personalized: 'personalizowana' }[booking.guestbook]} />
              </Grid>
              <Grid item xs={12}>
                <Info label="Lokalizacja" value={`${booking.venue_name ? booking.venue_name + ', ' : ''}${booking.venue_address}`} />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Info label="Cena całkowita" value={formatPrice(booking.total_price)} />
              </Grid>
              <Grid item xs={6}>
                <Info label={`Zadatek (${Number(booking.deposit_percent)}%)`} value={formatPrice(booking.deposit_amount)} />
              </Grid>
              {booking.paid_amount > 0 && (
                <>
                  <Grid item xs={6}>
                    <Info label="Wpłacono" value={formatPrice(booking.paid_amount)} />
                  </Grid>
                  <Grid item xs={6}>
                    <Info label="Pozostało do zapłaty" value={formatPrice(booking.remaining_amount)} />
                  </Grid>
                </>
              )}
            </Grid>
            {booking.contract && (
              <>
                <Divider sx={{ my: 2 }} />
                <Info
                  label="Umowa"
                  value={`${booking.contract.number} — ${
                    booking.contract.status === 'signed' ? `podpisana ${formatDate(booking.contract.signed_at)}` : 'oczekuje na podpis'
                  }`}
                />
              </>
            )}
            {booking.gallery_link && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary">
                  Galeria online
                </Typography>
                <Typography>
                  <Link href={booking.gallery_link} target="_blank" rel="noreferrer">
                    Zobacz zdjęcia z imprezy 📸
                  </Link>
                </Typography>
              </>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          {awaitingDeposit && (
            <Paper sx={{ p: 3, bgcolor: 'pink.light' }}>
              <Typography variant="h6" gutterBottom>
                Płatność zadatku
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Aby potwierdzić rezerwację, wpłać zadatek <strong>{formatPrice(booking.deposit_amount)}</strong>.
              </Typography>
              <Stack spacing={0.5} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Numer konta: <strong>{booking.bank_account || '(podamy w e-mailu)'}</strong>
                </Typography>
                <Typography variant="body2">
                  Tytuł przelewu: <strong>Zadatek {booking.contract?.number || `#${booking.id}`}</strong>
                </Typography>
              </Stack>
              {booking.paynow_enabled && (
                <Button variant="contained" fullWidth onClick={payOnline}>
                  Zapłać online (PayNow)
                </Button>
              )}
            </Paper>
          )}
        </Grid>

        <Grid item xs={12}>
          <ClientContractSigning bookingId={booking.id} />
        </Grid>

        <Grid item xs={12}>
          <ChatPanel bookingId={booking.id} />
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Personalizacja
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wybierz animację, tło i szablon wydruku oraz wpisz tekst, który pojawi się na zdjęciach.
            </Typography>
            <PersonalizationEditor
              bookingId={booking.id}
              initial={booking.personalization}
              editable={booking.personalization_editable}
              guestbook={booking.guestbook}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
