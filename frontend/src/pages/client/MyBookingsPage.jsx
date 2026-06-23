import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, Button, CircularProgress, Chip,
} from '@mui/material';
import { api } from '../../api/client';
import StatusChip from '../../components/common/StatusChip';
import { formatDate, formatPrice, formatTime } from '../../utils/format';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState(null);

  useEffect(() => {
    api.get('/bookings').then(({ data }) => setBookings(data));
  }, []);

  if (!bookings)
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Moje rezerwacje
      </Typography>
      {bookings.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Nie masz jeszcze żadnych rezerwacji.
          </Typography>
          <Button component={RouterLink} to="/rezerwacja" variant="contained">
            Zarezerwuj fotolustro
          </Button>
        </Paper>
      ) : (
        <>
          {/* Telefon: lista kart — bez przewijania w bok */}
          <Stack spacing={1.5} sx={{ display: { md: 'none' } }}>
            {bookings.map((booking) => (
              <Paper key={booking.id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600}>
                      {formatDate(booking.event_date)} {formatTime(booking.start_time)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {booking.package_name} • {formatPrice(booking.total_price)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {booking.venue_name || booking.venue_address}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <StatusChip status={booking.status} label={booking.status_label} />
                      {booking.personalization_editable && (
                        <Chip size="small" variant="outlined" color="primary" label="personalizuj!" sx={{ ml: 0.5, mt: 0.5 }} />
                      )}
                    </Box>
                  </Box>
                  <Button component={RouterLink} to={`/konto/rezerwacje/${booking.id}`} size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                    Szczegóły
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>

          {/* Desktop: tabela */}
          <Paper sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Termin</TableCell>
                  <TableCell>Pakiet</TableCell>
                  <TableCell>Lokalizacja</TableCell>
                  <TableCell>Kwota</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id} hover>
                    <TableCell>
                      {formatDate(booking.event_date)} {formatTime(booking.start_time)}
                    </TableCell>
                    <TableCell>{booking.package_name}</TableCell>
                    <TableCell>{booking.venue_name || booking.venue_address}</TableCell>
                    <TableCell>{formatPrice(booking.total_price)}</TableCell>
                    <TableCell>
                      <StatusChip status={booking.status} label={booking.status_label} />
                      {booking.personalization_editable && (
                        <Chip size="small" variant="outlined" color="primary" label="personalizuj!" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button component={RouterLink} to={`/konto/rezerwacje/${booking.id}`} size="small">
                        Szczegóły
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
