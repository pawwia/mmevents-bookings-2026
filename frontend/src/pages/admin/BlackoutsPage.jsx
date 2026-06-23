import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Grid, IconButton, Paper, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api, apiError } from '../../api/client';
import { formatDate } from '../../utils/format';

/**
 * CRM: urlopy / blokady terminów. Zablokuj pojedynczy dzień lub przedział.
 * Komentarz pokazuje się klientowi przy sprawdzaniu terminu (np. „ograniczone godziny, prosimy o kontakt").
 */
export default function BlackoutsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ start_date: '', end_date: '', comment: '' });
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/blackouts').then(({ data }) => setItems(data));
  }, []);
  useEffect(load, [load]);

  const run = async (fn, text) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ severity: 'success', text });
      load();
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  const add = () =>
    run(async () => {
      await api.post('/admin/blackouts', {
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        comment: form.comment || null,
      });
      setForm({ start_date: '', end_date: '', comment: '' });
    }, 'Blokada dodana');

  const remove = (id) => {
    if (!window.confirm('Usunąć tę blokadę?')) return;
    run(() => api.delete(`/admin/blackouts/${id}`), 'Blokada usunięta');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Urlopy / blokady terminów
      </Typography>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dodaj blokadę
        </Typography>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} sm={3}>
            <TextField
              label="Od dnia"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Do dnia (opcjonalnie)"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              helperText="Puste = jeden dzień"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Komentarz dla klienta (opcjonalnie)"
              fullWidth
              size="small"
              multiline
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder="np. W tych dniach mamy ograniczone godziny — prosimy o kontakt telefoniczny."
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={add}
              disabled={!form.start_date}
              sx={{ height: 40 }}
              fullWidth
            >
              Dodaj
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Termin</TableCell>
              <TableCell>Komentarz dla klienta</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((b) => (
              <TableRow key={b.id} hover>
                <TableCell>
                  {b.start_date === b.end_date
                    ? formatDate(b.start_date)
                    : `${formatDate(b.start_date)} – ${formatDate(b.end_date)}`}
                </TableCell>
                <TableCell>
                  {b.comment || <Typography variant="caption" color="text.secondary">— (bez komentarza)</Typography>}
                </TableCell>
                <TableCell align="right">
                  <IconButton color="error" onClick={() => remove(b.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Brak blokad. Dodaj urlop lub niedostępny termin powyżej.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
