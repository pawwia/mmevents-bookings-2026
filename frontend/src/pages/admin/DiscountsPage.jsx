import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack,
  Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { api, apiError } from '../../api/client';
import { formatDate, formatPrice } from '../../utils/format';

/** CRM: kody rabatowe — kwotowe/procentowe, ważność, limit użyć, włączanie/wyłączanie. */
export default function DiscountsPage() {
  const [codes, setCodes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/admin/discounts').then(({ data }) => setCodes(data));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    setError('');
    try {
      if (editing.id) await api.put(`/admin/discounts/${editing.id}`, editing);
      else await api.post('/admin/discounts', editing);
      setEditing(null);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Usunąć kod rabatowy?')) return;
    await api.delete(`/admin/discounts/${id}`);
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Kody rabatowe</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({ type: 'amount', is_active: 1 })}>
          Nowy kod
        </Button>
      </Stack>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kod</TableCell>
              <TableCell>Rabat</TableCell>
              <TableCell>Ważność</TableCell>
              <TableCell>Użycia</TableCell>
              <TableCell>Aktywny</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {codes.map((code) => (
              <TableRow key={code.id} hover>
                <TableCell>
                  <strong>{code.code}</strong>
                </TableCell>
                <TableCell>{code.type === 'percent' ? `${Number(code.value)}%` : formatPrice(code.value)}</TableCell>
                <TableCell>
                  {code.valid_from ? formatDate(code.valid_from) : '∞'} → {code.valid_until ? formatDate(code.valid_until) : '∞'}
                </TableCell>
                <TableCell>
                  {code.used_count}
                  {code.usage_limit ? ` / ${code.usage_limit}` : ''}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={!!Number(code.is_active)}
                    onChange={async (e) => {
                      await api.put(`/admin/discounts/${code.id}`, { is_active: e.target.checked ? 1 : 0 });
                      load();
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEditing(code)}>
                    Edytuj
                  </Button>
                  <Button size="small" color="error" onClick={() => remove(code.id)}>
                    Usuń
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{editing?.id ? `Edytuj kod ${editing.code}` : 'Nowy kod rabatowy'}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              {!editing.id && (
                <TextField
                  label="Kod (np. WESELE2026)"
                  value={editing.code || ''}
                  onChange={(e) => setEditing((s) => ({ ...s, code: e.target.value.toUpperCase() }))}
                />
              )}
              <TextField
                select
                label="Typ rabatu"
                value={editing.type}
                onChange={(e) => setEditing((s) => ({ ...s, type: e.target.value }))}
              >
                <MenuItem value="amount">Kwotowy (zł)</MenuItem>
                <MenuItem value="percent">Procentowy (%)</MenuItem>
              </TextField>
              <TextField
                label="Wartość"
                type="number"
                value={editing.value || ''}
                onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))}
              />
              <TextField
                label="Ważny od"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={editing.valid_from || ''}
                onChange={(e) => setEditing((s) => ({ ...s, valid_from: e.target.value || null }))}
              />
              <TextField
                label="Ważny do"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={editing.valid_until || ''}
                onChange={(e) => setEditing((s) => ({ ...s, valid_until: e.target.value || null }))}
              />
              <TextField
                label="Limit użyć (puste = bez limitu)"
                type="number"
                value={editing.usage_limit ?? ''}
                onChange={(e) => setEditing((s) => ({ ...s, usage_limit: e.target.value === '' ? null : Number(e.target.value) }))}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Anuluj</Button>
          <Button variant="contained" onClick={save}>
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
