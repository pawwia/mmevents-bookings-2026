import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Grid, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/SendOutlined';
import { api, apiError } from '../../api/client';
import { formatDate, formatPrice, EVENT_TYPES } from '../../utils/format';

const OFFER_STATUS = {
  draft: { label: 'Szkic', color: 'default' },
  sent: { label: 'Wysłana', color: 'info' },
  accepted: { label: 'Zaakceptowana', color: 'success' },
  cancelled: { label: 'Anulowana', color: 'error' },
};

const EMPTY_VARIANT = { name: '', price: '', package_id: '', duration_hours: '', itemsText: '', description: '' };

/**
 * CRM → Oferty: ręczne wystawianie ofert z wariantami cenowymi.
 * Admin podaje dane imprezy i klienta (NIP → GUS), wybiera elementy stockowe pakietu
 * i dopisuje własne udogodnienia. Klient wybiera wariant na stronie /oferta/{token}.
 */
export default function OffersPage() {
  const [offers, setOffers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/offers').then(({ data }) => setOffers(data));
  }, []);

  useEffect(() => {
    load();
    api.get('/admin/packages').then(({ data }) => setPackages(data.filter((p) => Number(p.is_active))));
  }, [load]);

  const run = async (fn, text) => {
    setMessage(null);
    try {
      const result = await fn();
      setMessage({ severity: 'success', text });
      load();
      return result;
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
      throw e;
    }
  };

  const openEditor = (offer = null) =>
    setEditing(
      offer
        ? {
            ...offer,
            variants: offer.variants.map((v) => ({ ...v, itemsText: (v.items || []).join('\n') })),
          }
        : { client_name: '', email: '', phone: '', event_type: 'wesele', variants: [{ ...EMPTY_VARIANT }] }
    );

  const setField = (key, value) => setEditing((s) => ({ ...s, [key]: value }));
  const setVariant = (index, key, value) =>
    setEditing((s) => ({
      ...s,
      variants: s.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    }));

  /** Wybór pakietu bazowego podpowiada elementy stockowe (zawartość pakietu z cennika). */
  const applyPackage = (index, packageId) => {
    const pkg = packages.find((p) => p.id === Number(packageId));
    const price = pkg?.prices?.find((pr) => Number(pr.year) === new Date().getFullYear()) || pkg?.prices?.[0];
    setEditing((s) => ({
      ...s,
      variants: s.variants.map((v, i) =>
        i === index
          ? {
              ...v,
              package_id: packageId,
              duration_hours: v.duration_hours || pkg?.duration_hours || '',
              price: v.price || price?.price || '',
              itemsText: v.itemsText || (price?.features?.included || []).join('\n'),
            }
          : v
      ),
    }));
  };

  const lookupNip = async () => {
    if (!editing?.nip) return;
    try {
      const { data } = await api.get('/nip', { params: { nip: editing.nip } });
      setEditing((s) => ({
        ...s,
        company_name: data.company_name,
        client_name: s.client_name || data.representatives?.[0] || data.company_name,
      }));
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  const save = async () => {
    const payload = {
      ...editing,
      variants: editing.variants.map((v) => ({
        ...v,
        items: (v.itemsText || '').split('\n').map((line) => line.trim()).filter(Boolean),
      })),
    };
    await run(async () => {
      if (editing.id) await api.put(`/admin/offers/${editing.id}`, payload);
      else await api.post('/admin/offers', payload);
      setEditing(null);
    }, 'Oferta zapisana');
  };

  const copyLink = (offer) => {
    navigator.clipboard.writeText(offer.link || `${window.location.origin}/oferta/${offer.token}`);
    setMessage({ severity: 'success', text: 'Link do oferty skopiowany do schowka' });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Oferty</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEditor()}>
          Nowa oferta
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Klient</TableCell>
              <TableCell>Impreza</TableCell>
              <TableCell>Warianty</TableCell>
              <TableCell>Ważna do</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {offers.map((offer) => {
              const status = OFFER_STATUS[offer.status] || OFFER_STATUS.draft;
              return (
                <TableRow key={offer.id} hover>
                  <TableCell>
                    <strong>{offer.client_name}</strong>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {offer.company_name || offer.email || offer.phone}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {offer.event_type} {offer.guests_count ? `(${offer.guests_count} os.)` : ''}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {offer.event_date ? formatDate(offer.event_date) : 'termin do ustalenia'}
                      {offer.venue_name ? ` • ${offer.venue_name}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {offer.variants.map((v) => (
                      <Chip key={v.id} size="small" label={`${v.name}: ${formatPrice(v.price)}`} sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>{offer.valid_until ? formatDate(offer.valid_until) : '∞'}</TableCell>
                  <TableCell>
                    <Chip size="small" color={status.color} label={status.label} />
                    {offer.booking_id && (
                      <Button component={RouterLink} to={`/admin/rezerwacje/${offer.booking_id}`} size="small">
                        rezerwacja #{offer.booking_id}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton size="small" title="Kopiuj link" onClick={() => copyLink(offer)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                    {offer.email && offer.status !== 'accepted' && (
                      <IconButton
                        size="small"
                        title="Wyślij e-mailem"
                        onClick={() => run(() => api.post(`/admin/offers/${offer.id}/send`), 'Oferta zakolejkowana do wysyłki')}
                      >
                        <SendIcon fontSize="small" />
                      </IconButton>
                    )}
                    {offer.status !== 'accepted' && (
                      <>
                        <Button size="small" onClick={() => openEditor(offer)}>
                          Edytuj
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (window.confirm('Usunąć ofertę?')) run(() => api.delete(`/admin/offers/${offer.id}`), 'Oferta usunięta');
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>{editing?.id ? 'Edytuj ofertę' : 'Nowa oferta'}</DialogTitle>
        <DialogContent>
          {editing && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} sm={6}>
                <TextField label="Imię i nazwisko klienta *" fullWidth size="small" value={editing.client_name || ''} onChange={(e) => setField('client_name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="E-mail (do wysyłki oferty)" fullWidth size="small" value={editing.email || ''} onChange={(e) => setField('email', e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Telefon" fullWidth size="small" value={editing.phone || ''} onChange={(e) => setField('phone', e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="NIP" fullWidth size="small" value={editing.nip || ''} onChange={(e) => setField('nip', e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Button variant="outlined" size="small" sx={{ height: '100%' }} fullWidth onClick={lookupNip}>
                  Pobierz z GUS
                </Button>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Nazwa firmy" fullWidth size="small" value={editing.company_name || ''} onChange={(e) => setField('company_name', e.target.value)} />
              </Grid>

              <Grid item xs={6} sm={3}>
                <TextField select label="Typ imprezy" fullWidth size="small" value={editing.event_type || 'wesele'} onChange={(e) => setField('event_type', e.target.value)}>
                  {EVENT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="Liczba osób" type="number" fullWidth size="small" value={editing.guests_count || ''} onChange={(e) => setField('guests_count', e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="Data" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={editing.event_date || ''} onChange={(e) => setField('event_date', e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="Start" type="time" fullWidth size="small" InputLabelProps={{ shrink: true }} value={(editing.start_time || '').slice(0, 5)} onChange={(e) => setField('start_time', e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Ważna do" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={editing.valid_until || ''} onChange={(e) => setField('valid_until', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField label="Nazwa obiektu" fullWidth size="small" value={editing.venue_name || ''} onChange={(e) => setField('venue_name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={7}>
                <TextField label="Adres imprezy" fullWidth size="small" value={editing.venue_address || ''} onChange={(e) => setField('venue_address', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Wiadomość powitalna na stronie oferty" fullWidth size="small" multiline minRows={2} value={editing.intro || ''} onChange={(e) => setField('intro', e.target.value)} />
              </Grid>

              <Grid item xs={12}>
                <Divider>Warianty cenowe</Divider>
              </Grid>
              {editing.variants.map((variant, index) => (
                <Grid item xs={12} key={index}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'pink.light' }}>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={4}>
                        <TextField label={`Wariant ${index + 1} — nazwa *`} fullWidth size="small" value={variant.name} onChange={(e) => setVariant(index, 'name', e.target.value)} />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField select label="Pakiet bazowy (stock)" fullWidth size="small" value={variant.package_id || ''} onChange={(e) => applyPackage(index, e.target.value)}>
                          <MenuItem value="">— brak —</MenuItem>
                          {packages.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {p.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField label="Cena (zł) *" type="number" fullWidth size="small" value={variant.price} onChange={(e) => setVariant(index, 'price', e.target.value)} />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField label="Czas (h)" type="number" fullWidth size="small" value={variant.duration_hours || ''} onChange={(e) => setVariant(index, 'duration_hours', e.target.value)} />
                      </Grid>
                      <Grid item xs={6} sm={1} sx={{ textAlign: 'right' }}>
                        <IconButton color="error" onClick={() => setEditing((s) => ({ ...s, variants: s.variants.filter((_, i) => i !== index) }))}>
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                      <Grid item xs={12} sm={7}>
                        <TextField
                          label="Pozycje oferty (1 na linię — stockowe + własne udogodnienia)"
                          fullWidth
                          size="small"
                          multiline
                          minRows={4}
                          value={variant.itemsText}
                          onChange={(e) => setVariant(index, 'itemsText', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <TextField label="Opis wariantu" fullWidth size="small" multiline minRows={4} value={variant.description || ''} onChange={(e) => setVariant(index, 'description', e.target.value)} />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}
              <Grid item xs={12}>
                <Button startIcon={<AddIcon />} onClick={() => setEditing((s) => ({ ...s, variants: [...s.variants, { ...EMPTY_VARIANT }] }))}>
                  Dodaj wariant
                </Button>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Anuluj</Button>
          <Button variant="contained" onClick={save}>
            Zapisz ofertę
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
