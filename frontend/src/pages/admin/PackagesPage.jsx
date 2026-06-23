import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem,
  Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography, FormControlLabel, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { api, apiError } from '../../api/client';
import { formatPrice } from '../../utils/format';

/**
 * CRM: pakiety + cennik per rok (2026, 2027, 2028, ...).
 * Administrator dodaje/wyłącza pakiety, ustawia ceny, darmowe km, opisy i zawartość
 * dla każdego roku — bez ingerencji programisty.
 */
export default function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingPrice, setEditingPrice] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/packages').then(({ data }) => setPackages(data));
  }, []);
  useEffect(load, [load]);

  const currentYear = new Date().getFullYear();
  const maxPriceYear = currentYear + 2; // cennik można prowadzić tylko dla bieżącego roku i 2 kolejnych
  const years = useMemo(() => {
    const all = new Set([year, currentYear, currentYear + 1, currentYear + 2]);
    packages.forEach((p) => p.prices.forEach((pr) => all.add(Number(pr.year))));
    return [...all].sort();
  }, [packages, year, currentYear]);

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

  const savePackage = () =>
    run(async () => {
      if (editingPackage.id) await api.put(`/admin/packages/${editingPackage.id}`, editingPackage);
      else await api.post('/admin/packages', editingPackage);
      setEditingPackage(null);
    }, 'Pakiet zapisany');

  const savePrice = () =>
    run(async () => {
      const payload = {
        ...editingPrice,
        features: {
          included: (editingPrice.includedText || '').split('\n').filter(Boolean),
          excluded: (editingPrice.excludedText || '').split('\n').filter(Boolean),
        },
      };
      await api.post(`/admin/packages/${editingPrice.package_id}/prices`, payload);
      setEditingPrice(null);
    }, `Cennik ${editingPrice.year} zapisany`);

  const copyYear = () =>
    run(
      () => api.post('/admin/packages/copy-year', { from_year: year, to_year: year + 1 }),
      `Cennik ${year} skopiowany na ${year + 1}`
    );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Pakiety i cennik</Typography>
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="Rok cennika" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </TextField>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={copyYear}
            disabled={year + 1 > maxPriceYear}
            title={year + 1 > maxPriceYear ? `Cennik można prowadzić maksymalnie do roku ${maxPriceYear}` : undefined}
          >
            Kopiuj {year} → {year + 1}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditingPackage({ is_active: 1, attraction_type_id: 1 })}>
            Nowy pakiet
          </Button>
        </Stack>
      </Stack>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pakiet</TableCell>
              <TableCell>Czas</TableCell>
              <TableCell>Cena ({year})</TableCell>
              <TableCell>Darmowe km</TableCell>
              <TableCell>Księga std / pers</TableCell>
              <TableCell>Aktywny</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {packages.map((pkg) => {
              const price = pkg.prices.find((p) => Number(p.year) === year);
              return (
                <TableRow key={pkg.id} hover sx={{ opacity: Number(pkg.is_active) ? 1 : 0.5 }}>
                  <TableCell>
                    <strong>{pkg.name}</strong>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {pkg.attraction_type}
                    </Typography>
                  </TableCell>
                  <TableCell>{Number(pkg.duration_hours)} h</TableCell>
                  <TableCell>{price ? formatPrice(price.price) : <Chip size="small" color="warning" label="brak cennika" />}</TableCell>
                  <TableCell>{price ? `${price.free_km} km` : '—'}</TableCell>
                  <TableCell>
                    {price
                      ? `${Number(price.guestbook_standard_price) === 0 ? 'gratis' : formatPrice(price.guestbook_standard_price)} / ${formatPrice(price.guestbook_personalized_price)}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={!!Number(pkg.is_active)}
                      onChange={(e) =>
                        run(() => api.put(`/admin/packages/${pkg.id}`, { is_active: e.target.checked ? 1 : 0 }), 'Zapisano')
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setEditingPackage(pkg)}>
                      Pakiet
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setEditingPrice({
                          package_id: pkg.id,
                          year,
                          price: price?.price ?? '',
                          free_km: price?.free_km ?? 0,
                          description: price?.description ?? '',
                          guestbook_standard_price: price?.guestbook_standard_price ?? 100,
                          guestbook_personalized_price: price?.guestbook_personalized_price ?? 150,
                          is_active: price?.is_active ?? 1,
                          includedText: (price?.features?.included || []).join('\n'),
                          excludedText: (price?.features?.excluded || []).join('\n'),
                        })
                      }
                    >
                      Cennik {year}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* Dialog pakietu */}
      <Dialog open={!!editingPackage} onClose={() => setEditingPackage(null)} fullWidth maxWidth="xs">
        <DialogTitle>{editingPackage?.id ? 'Edytuj pakiet' : 'Nowy pakiet'}</DialogTitle>
        <DialogContent>
          {editingPackage && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Nazwa (np. Pakiet 6H)"
                value={editingPackage.name || ''}
                onChange={(e) => setEditingPackage((s) => ({ ...s, name: e.target.value }))}
              />
              <TextField
                label="Czas trwania (h)"
                type="number"
                value={editingPackage.duration_hours || ''}
                onChange={(e) => setEditingPackage((s) => ({ ...s, duration_hours: e.target.value }))}
              />
              <TextField
                label="Kolejność"
                type="number"
                value={editingPackage.sort_order ?? 0}
                onChange={(e) => setEditingPackage((s) => ({ ...s, sort_order: Number(e.target.value) }))}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPackage(null)}>Anuluj</Button>
          <Button variant="contained" onClick={savePackage}>
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog cennika rocznego */}
      <Dialog open={!!editingPrice} onClose={() => setEditingPrice(null)} fullWidth maxWidth="sm">
        <DialogTitle>Cennik na rok {editingPrice?.year}</DialogTitle>
        <DialogContent>
          {editingPrice && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6}>
                <TextField
                  label="Cena (zł)"
                  type="number"
                  fullWidth
                  value={editingPrice.price}
                  onChange={(e) => setEditingPrice((s) => ({ ...s, price: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Darmowe km"
                  type="number"
                  fullWidth
                  value={editingPrice.free_km}
                  onChange={(e) => setEditingPrice((s) => ({ ...s, free_km: Number(e.target.value) }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Księga standardowa (zł, 0 = gratis)"
                  type="number"
                  fullWidth
                  value={editingPrice.guestbook_standard_price}
                  onChange={(e) => setEditingPrice((s) => ({ ...s, guestbook_standard_price: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Księga personalizowana (zł)"
                  type="number"
                  fullWidth
                  value={editingPrice.guestbook_personalized_price}
                  onChange={(e) => setEditingPrice((s) => ({ ...s, guestbook_personalized_price: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Opis pakietu"
                  fullWidth
                  multiline
                  minRows={2}
                  value={editingPrice.description || ''}
                  onChange={(e) => setEditingPrice((s) => ({ ...s, description: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Zawiera (1 pozycja na linię)"
                  fullWidth
                  multiline
                  minRows={6}
                  value={editingPrice.includedText}
                  onChange={(e) => setEditingPrice((s) => ({ ...s, includedText: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Nie zawiera (1 pozycja na linię)"
                  fullWidth
                  multiline
                  minRows={6}
                  value={editingPrice.excludedText}
                  onChange={(e) => setEditingPrice((s) => ({ ...s, excludedText: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!Number(editingPrice.is_active)}
                      onChange={(e) => setEditingPrice((s) => ({ ...s, is_active: e.target.checked ? 1 : 0 }))}
                    />
                  }
                  label="Cennik aktywny (pakiet dostępny w tym roku)"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPrice(null)}>Anuluj</Button>
          <Button variant="contained" onClick={savePrice}>
            Zapisz cennik
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
