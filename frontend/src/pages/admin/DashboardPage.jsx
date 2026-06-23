import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, CircularProgress, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography, Button, Alert,
} from '@mui/material';
import { api } from '../../api/client';
import StatusChip from '../../components/common/StatusChip';
import { formatDate, formatPrice, formatTime } from '../../utils/format';

function StatCard({ label, value, accent }) {
  return (
    <Paper sx={{ p: 2.5, bgcolor: accent ? 'pink.light' : '#fff' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(({ data }) => setData(data));
  }, []);

  if (!data)
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );

  const counts = data.status_counts;
  const failures = data.queues.email_failed + data.queues.sms_failed;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      {failures > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Kolejka komunikacji zgłasza {failures} nieudanych wysyłek (e-mail: {data.queues.email_failed}, SMS:{' '}
          {data.queues.sms_failed}). Sprawdź konfigurację Brevo / SMSAPI w Ustawieniach.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard label="Nowe zapytania" value={counts.new || 0} accent />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Oczekuje na zadatek" value={counts.awaiting_deposit || 0} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Potwierdzone" value={(counts.confirmed || 0) + (counts.last_call || 0) + (counts.ready || 0)} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Przychód (ten miesiąc)" value={formatPrice(data.month_revenue)} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Najbliższe realizacje</Typography>
              <Button component={RouterLink} to="/admin/kalendarz" size="small">
                Kalendarz →
              </Button>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Termin</TableCell>
                  <TableCell>Klient</TableCell>
                  <TableCell>Lokalizacja</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.upcoming.map((b) => (
                  <TableRow key={b.id} hover component={RouterLink} to={`/admin/rezerwacje/${b.id}`} sx={{ textDecoration: 'none' }}>
                    <TableCell>
                      {formatDate(b.event_date)} {formatTime(b.start_time)}
                    </TableCell>
                    <TableCell>
                      {b.first_name} {b.last_name}
                    </TableCell>
                    <TableCell>{b.venue_name || b.venue_address}</TableCell>
                    <TableCell>
                      <StatusChip status={b.status} label={b.status_label} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Wymaga Twojej uwagi
            </Typography>
            <Table size="small">
              <TableBody>
                {data.attention.map((b) => (
                  <TableRow key={b.id} hover component={RouterLink} to={`/admin/rezerwacje/${b.id}`} sx={{ textDecoration: 'none' }}>
                    <TableCell>#{b.id}</TableCell>
                    <TableCell>
                      {b.first_name} {b.last_name}
                    </TableCell>
                    <TableCell>{formatDate(b.event_date)}</TableCell>
                    <TableCell>
                      <StatusChip status={b.status} label={b.status_label} />
                    </TableCell>
                  </TableRow>
                ))}
                {data.attention.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography color="text.secondary" variant="body2">
                        Wszystko ogarnięte ✨
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
