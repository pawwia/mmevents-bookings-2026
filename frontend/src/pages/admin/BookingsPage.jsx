import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, MenuItem, Paper, Stack, Switch, FormControlLabel, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography, Chip, Button,
} from '@mui/material';
import dayjs from 'dayjs';
import { api } from '../../api/client';
import StatusChip from '../../components/common/StatusChip';
import { formatDate, formatPrice, formatTime } from '../../utils/format';

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [statuses, setStatuses] = useState([]);
  // Domyślnie: bez roku/miesiąca, „pokaż przeszłe" wyłączone → od dziś w przód, sort rosnąco.
  const [filters, setFilters] = useState({ status: '', q: '', year: '', month: '', showPast: false, sort: 'asc' });

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1, y + 2];
  }, []);

  useEffect(() => {
    api.get('/admin/bookings/statuses').then(({ data }) => setStatuses(data));
  }, []);

  // Zakres dat z filtrów (rok/miesiąc + „pokaż przeszłe").
  const dateRange = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const { year, month, showPast } = filters;
    if (year) {
      const base = month ? dayjs(`${year}-${String(month).padStart(2, '0')}-01`) : dayjs(`${year}-01-01`);
      const start = base.format('YYYY-MM-DD');
      const end = (month ? base.endOf('month') : dayjs(`${year}-12-31`)).format('YYYY-MM-DD');
      return { from: showPast ? start : start < today ? today : start, to: end };
    }
    return { from: showPast ? undefined : today, to: undefined }; // od dziś w przód (lub wszystko)
  }, [filters]);

  const load = useCallback(() => {
    api
      .get('/admin/bookings', {
        params: {
          status: filters.status || undefined,
          q: filters.q || undefined,
          sort: filters.sort,
          from: dateRange.from,
          to: dateRange.to,
        },
      })
      .then(({ data }) => setBookings(data));
  }, [filters, dateRange]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Rezerwacje
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Sortowanie"
          value={filters.sort}
          onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="asc">Od najstarszego</MenuItem>
          <MenuItem value="desc">Od najmłodszego</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Rok"
          value={filters.year}
          onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value, month: e.target.value ? f.month : '' }))}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="">Wszystkie</MenuItem>
          {years.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Miesiąc"
          value={filters.month}
          disabled={!filters.year}
          onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
          sx={{ minWidth: 150 }}
          helperText={!filters.year ? 'najpierw wybierz rok' : undefined}
        >
          <MenuItem value="">Cały rok</MenuItem>
          {MONTHS.map((m, i) => (
            <MenuItem key={m} value={i + 1}>
              {m}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Switch checked={filters.showPast} onChange={(e) => setFilters((f) => ({ ...f, showPast: e.target.checked }))} />}
          label="Pokaż przeszłe"
        />
        <TextField
          select
          size="small"
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Wszystkie</MenuItem>
          {statuses.map((s) => (
            <MenuItem key={s.code} value={s.code}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Szukaj (klient, e-mail, lokalizacja)"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          sx={{ flexGrow: 1, minWidth: 220 }}
        />
      </Stack>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Termin</TableCell>
              <TableCell>Klient</TableCell>
              <TableCell>Pakiet</TableCell>
              <TableCell>Lokalizacja</TableCell>
              <TableCell>Kwota</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id} hover>
                <TableCell>{b.id}</TableCell>
                <TableCell>
                  {formatDate(b.event_date)} {formatTime(b.start_time)}
                </TableCell>
                <TableCell>
                  {b.first_name} {b.last_name}
                  <Typography variant="caption" display="block" color="text.secondary">
                    {b.phone}
                  </Typography>
                </TableCell>
                <TableCell>{b.package_name}</TableCell>
                <TableCell>{b.venue_name || b.venue_address}</TableCell>
                <TableCell>{formatPrice(b.total_price)}</TableCell>
                <TableCell>
                  <StatusChip status={b.status} label={b.status_label} />
                  {!!Number(b.requires_manual_confirmation) && b.status === 'new' && (
                    <Chip size="small" variant="outlined" color="warning" label="kolizja terminu" sx={{ ml: 0.5 }} />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button component={RouterLink} to={`/admin/rezerwacje/${b.id}`} size="small">
                    Otwórz
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
