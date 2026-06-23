import { useCallback, useEffect, useState } from 'react';
import {
  Box, Chip, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs,
  TextField, Typography, Button,
} from '@mui/material';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOffOutlined';
import { api } from '../../api/client';
import { formatDate, formatDateTime } from '../../utils/format';

export default function AvailabilityChecksPage() {
  const [tab, setTab] = useState('list');
  const [rows, setRows] = useState([]);
  const [topIps, setTopIps] = useState([]);
  const [filters, setFilters] = useState({ ip: '', from: '', to: '' });

  const loadList = useCallback(() => {
    api.get('/admin/availability-checks', {
      params: { ip: filters.ip || undefined, from: filters.from || undefined, to: filters.to || undefined },
    }).then(({ data }) => setRows(data));
  }, [filters]);

  const loadTop = useCallback(() => {
    api.get('/admin/availability-checks/top-ips').then(({ data }) => setTopIps(data));
  }, []);

  useEffect(() => {
    const t = setTimeout(loadList, 200);
    return () => clearTimeout(t);
  }, [loadList]);
  useEffect(loadTop, [loadTop]);

  const filterByIp = (ip) => {
    setFilters((f) => ({ ...f, ip }));
    setTab('list');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Sprawdzenia terminów
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Które daty ktoś sprawdzał w kreatorze rezerwacji, z jakiego adresu IP i kiedy. E-mail jest
        dopasowywany po IP (zalogowany klient lub rezerwacja złożona z tego samego adresu).
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Wszystkie sprawdzenia" value="list" />
        <Tab label="Ranking IP (kto najwięcej)" value="top" />
      </Tabs>

      {tab === 'list' && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
            <TextField size="small" label="Filtruj po IP" value={filters.ip} onChange={(e) => setFilters((f) => ({ ...f, ip: e.target.value }))} />
            <TextField size="small" type="date" label="Od" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            <TextField size="small" type="date" label="Do" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            {(filters.ip || filters.from || filters.to) && (
              <Button size="small" startIcon={<FilterAltOffIcon />} onClick={() => setFilters({ ip: '', from: '', to: '' })}>
                Wyczyść
              </Button>
            )}
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sprawdzono (kiedy)</TableCell>
                  <TableCell>Sprawdzany termin</TableCell>
                  <TableCell>Wolny?</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>Możliwy klient / e-mail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{formatDateTime(r.created_at)}</TableCell>
                    <TableCell><strong>{formatDate(r.check_date)}</strong></TableCell>
                    <TableCell>
                      <Chip size="small" color={Number(r.available) ? 'success' : 'warning'} label={Number(r.available) ? 'wolny' : 'zajęty'} />
                    </TableCell>
                    <TableCell>
                      <Button size="small" sx={{ textTransform: 'none', fontFamily: 'monospace' }} onClick={() => filterByIp(r.ip)}>
                        {r.ip || '—'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {r.client && <div>{r.client}</div>}
                      {r.email ? <Typography variant="caption" color="text.secondary">{r.email}</Typography> : (!r.client && '—')}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">Brak sprawdzeń.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 'top' && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>IP</TableCell>
                <TableCell>Liczba sprawdzeń</TableCell>
                <TableCell>Różnych terminów</TableCell>
                <TableCell>Ostatnio</TableCell>
                <TableCell>Możliwy e-mail</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {topIps.map((r) => (
                <TableRow key={r.ip} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.ip}</TableCell>
                  <TableCell><strong>{r.checks}</strong></TableCell>
                  <TableCell>{r.distinct_dates}</TableCell>
                  <TableCell>{formatDateTime(r.last_check)}</TableCell>
                  <TableCell>{r.matched_email || '—'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => filterByIp(r.ip)}>Pokaż sprawdzenia</Button>
                  </TableCell>
                </TableRow>
              ))}
              {topIps.length === 0 && (
                <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">Brak danych.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
