import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider, FormControlLabel, Grid,
  MenuItem, Paper, Stack, Switch, TextField, Typography, List, ListItem, ListItemIcon, ListItemText,
  Dialog, DialogActions, DialogContent, DialogTitle,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditIcon from '@mui/icons-material/EditOutlined';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import PlayCircleIcon from '@mui/icons-material/PlayCircleOutline';
import { api, apiError } from '../../api/client';
import StatusChip from '../../components/common/StatusChip';
import { ImagePreviewDialog, YouTubeDialog } from '../../components/common/MediaDialogs';
import ContractSigning from '../../components/admin/ContractSigning';
import ChatPanel from '../../components/common/ChatPanel';
import { formatDate, formatDateTime, formatPrice, formatTime, EVENT_TYPES } from '../../utils/format';

function ChecklistItem({ done, label, detail, image, onPreview, previewIcon }) {
  return (
    <ListItem
      disableGutters
      secondaryAction={
        onPreview ? (
          <Button size="small" startIcon={previewIcon || <ZoomInIcon />} onClick={onPreview}>
            Podejrzyj
          </Button>
        ) : undefined
      }
    >
      <ListItemIcon sx={{ minWidth: 34 }}>
        {done ? <CheckCircleIcon color="success" /> : <RadioButtonUncheckedIcon color="disabled" />}
      </ListItemIcon>
      {image && (
        <Box
          component="img"
          src={image}
          alt={label}
          onClick={onPreview}
          sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1, mr: 1.5, bgcolor: '#EEE', cursor: onPreview ? 'pointer' : 'default' }}
        />
      )}
      <ListItemText primary={label} secondary={detail || (done ? null : 'brak')} sx={{ pr: onPreview ? 10 : 0 }} />
    </ListItem>
  );
}

/** CRM — karta rezerwacji: checklista realizacji, statusy, zadatek, umowa, galeria, notatki. */
export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [booking, setBooking] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [message, setMessage] = useState(null);
  const [gallery, setGallery] = useState({ link: '', askReview: true });
  const [notes, setNotes] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [newPayment, setNewPayment] = useState({ amount: '', type: 'final' });
  const [packages, setPackages] = useState([]);
  const [editBooking, setEditBooking] = useState(null); // dane dialogu „Edytuj rezerwację"
  const [editClient, setEditClient] = useState(null);   // dane dialogu „Edytuj dane klienta"
  const [imagePreview, setImagePreview] = useState(null); // { src, title }
  const [videoPreview, setVideoPreview] = useState(null); // { url, title }

  const load = useCallback(() => {
    api.get(`/admin/bookings/${id}`).then(({ data }) => {
      setBooking(data);
      setGallery({ link: data.gallery_link || '', askReview: !!Number(data.ask_review) });
      setNotes(data.admin_notes || '');
      setDepositAmount(String(data.deposit_amount ?? ''));
    });
  }, [id]);

  useEffect(() => {
    load();
    api.get('/admin/bookings/statuses').then(({ data }) => setStatuses(data));
    api.get('/admin/packages').then(({ data }) => setPackages(data));
  }, [load]);

  const openBookingEditor = () =>
    setEditBooking({
      event_date: booking.event_date,
      start_time: formatTime(booking.start_time),
      package_id: booking.package_id,
      duration_hours: booking.duration_hours,
      venue_name: booking.venue_name || '',
      venue_address: booking.venue_address || '',
      distance_km: booking.distance_km,
      event_type: booking.event_type || 'wesele',
      guests_count: booking.guests_count || '',
      package_price: booking.package_price,
      transport_cost: booking.transport_cost,
      guestbook: booking.guestbook,
      guestbook_price: booking.guestbook_price,
      discount_amount: booking.discount_amount,
      deposit_percent: booking.deposit_percent,
    });

  const openClientEditor = () =>
    setEditClient({
      first_name: booking.first_name || '',
      last_name: booking.last_name || '',
      email: booking.email || '',
      phone: booking.phone || '',
      type: booking.client_type || 'private',
      street: booking.street || '',
      house_no: booking.house_no || '',
      apartment_no: booking.apartment_no || '',
      postal_code: booking.postal_code || '',
      city: booking.city || '',
      company_name: booking.company_name || '',
      nip: booking.nip || '',
      company_address: booking.company_address || '',
      representative: booking.representative || '',
    });

  const saveBookingEdit = () =>
    action(async () => {
      const payload = Object.fromEntries(
        Object.entries(editBooking).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      await api.patch(`/admin/bookings/${id}`, payload);
      setEditBooking(null);
    }, 'Rezerwacja zaktualizowana — suma i zadatek przeliczone');

  const saveClientEdit = () =>
    action(async () => {
      await api.patch(`/admin/bookings/${id}/client`, editClient);
      setEditClient(null);
    }, 'Dane klienta zaktualizowane');

  // Podgląd sumy w dialogu edycji (backend liczy tak samo)
  const editTotal = editBooking
    ? Number(editBooking.package_price || 0) +
      Number(editBooking.transport_cost || 0) +
      Number(editBooking.guestbook_price || 0) -
      Number(editBooking.discount_amount || 0)
    : 0;

  const action = async (fn, successText) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ severity: 'success', text: successText });
      load();
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  if (!booking)
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );

  const checklist = booking.checklist;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">Rezerwacja #{booking.id}</Typography>
        <StatusChip status={booking.status} label={booking.status_label} />
        {!!Number(booking.requires_manual_confirmation) && booking.status === 'new' && (
          <Alert severity="warning" sx={{ py: 0 }}>
            Zapytanie — termin częściowo zajęty, wymaga ręcznej decyzji
          </Alert>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button startIcon={<EditIcon />} variant="outlined" onClick={openBookingEditor}>
          Edytuj rezerwację
        </Button>
        <Button startIcon={<EditIcon />} onClick={openClientEditor}>
          Edytuj dane klienta
        </Button>
        <Button color="error" onClick={() => setDeleteOpen(true)}>
          Usuń rezerwację
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Lewa kolumna: dane imprezy + klient */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Impreza
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Termin</Typography>
                <Typography fontWeight={600}>
                  {formatDate(booking.event_date)} {formatTime(booking.start_time)} ({Number(booking.duration_hours)} h)
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Pakiet</Typography>
                <Typography fontWeight={600}>{booking.package_name}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Typ imprezy</Typography>
                <Typography fontWeight={600}>
                  {booking.event_type || '—'}
                  {booking.guests_count ? ` • ${booking.guests_count} osób` : ''}
                </Typography>
              </Grid>
              {!!Number(booking.requires_individual_quote) && (
                <Grid item xs={6}>
                  <Alert severity="warning" sx={{ py: 0 }}>
                    Wycena indywidualna — przygotuj ofertę (zakładka Oferty)
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Lokalizacja</Typography>
                <Typography fontWeight={600}>
                  {booking.venue_name ? `${booking.venue_name}, ` : ''}
                  {booking.venue_address}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Number(booking.distance_km)} km od siedziby (~{booking.travel_time_min} min) • transport:{' '}
                  {formatPrice(booking.transport_cost)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Razem</Typography>
                <Typography fontWeight={700}>{formatPrice(booking.total_price)}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Zadatek</Typography>
                <Typography fontWeight={700}>{formatPrice(booking.deposit_amount)}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Rabat</Typography>
                <Typography fontWeight={700}>{formatPrice(booking.discount_amount)}</Typography>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Klient
            </Typography>
            <Typography fontWeight={600}>
              {booking.first_name} {booking.last_name}
              {booking.client_type === 'company' && ` — ${booking.company_name} (NIP ${booking.nip})`}
            </Typography>
            <Typography variant="body2">{booking.email} • {booking.phone}</Typography>
            <Typography variant="body2" color="text.secondary">
              {booking.client_type === 'company'
                ? booking.company_address
                : [booking.street && `${booking.street} ${booking.house_no}${booking.apartment_no ? '/' + booking.apartment_no : ''}`, booking.postal_code, booking.city].filter(Boolean).join(', ')}
            </Typography>
            {booking.client_notes && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Uwagi klienta: {booking.client_notes}
              </Alert>
            )}
            <Divider sx={{ my: 2 }} />
            <TextField
              label="Notatki administratora"
              fullWidth
              multiline
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => action(() => api.patch(`/admin/bookings/${id}`, { admin_notes: notes }), 'Notatki zapisane')}
            >
              Zapisz notatki
            </Button>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Historia statusów
            </Typography>
            {booking.history.map((h) => (
              <Typography key={h.id} variant="body2" sx={{ mb: 0.5 }}>
                {formatDateTime(h.created_at)} — <strong>{h.new_status}</strong>
                {h.first_name ? ` (${h.first_name} ${h.last_name})` : ' (system)'}
                {h.note ? ` — ${h.note}` : ''}
              </Typography>
            ))}
          </Paper>
        </Grid>

        {/* Prawa kolumna: checklista + akcje */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, mb: 2, bgcolor: 'pink.light' }}>
            <Typography variant="h6" gutterBottom>
              Checklista realizacji
            </Typography>
            <List dense disablePadding>
              <ChecklistItem
                done={!!checklist.animation}
                label="Animacja"
                detail={checklist.animation}
                image={checklist.animation_thumbnail}
                previewIcon={<PlayCircleIcon />}
                onPreview={
                  checklist.animation_youtube
                    ? () => setVideoPreview({ url: checklist.animation_youtube, title: checklist.animation })
                    : undefined
                }
              />
              <ChecklistItem
                done={!!checklist.background}
                label="Tło"
                detail={checklist.background}
                image={checklist.background_image}
                onPreview={
                  checklist.background_image
                    ? () => setImagePreview({ src: checklist.background_image, title: `Tło: ${checklist.background}` })
                    : undefined
                }
              />
              <ChecklistItem
                done={!!checklist.print_template}
                label="Szablon wydruku"
                detail={checklist.print_template}
                image={checklist.print_template_image}
                onPreview={
                  checklist.print_template_image
                    ? () => setImagePreview({ src: checklist.print_template_image, title: `Szablon: ${checklist.print_template}` })
                    : undefined
                }
              />
              <ChecklistItem done={!!checklist.print_text} label="Tekst na wydruku" detail={checklist.print_text} />
              <ChecklistItem
                done={checklist.guestbook !== 'none'}
                label="Księga gości"
                image={checklist.guestbook_design_image}
                onPreview={
                  checklist.guestbook_design_image
                    ? () => setImagePreview({ src: checklist.guestbook_design_image, title: `Księga: ${checklist.guestbook_design}` })
                    : undefined
                }
                detail={[
                  { none: 'brak', standard: 'standardowa', personalized: 'personalizowana' }[checklist.guestbook],
                  checklist.guestbook_design && `wzór: ${checklist.guestbook_design}`,
                  checklist.guestbook_names && `nadruk: „${checklist.guestbook_names}"`,
                  checklist.guestbook_date && `data: ${checklist.guestbook_date}`,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              />
              <ChecklistItem
                done={checklist.contract_signed}
                label="Umowa podpisana"
                detail={checklist.contract ? `${checklist.contract.number} (${checklist.contract.status})` : null}
              />
              <ChecklistItem
                done={checklist.deposit_paid}
                label="Zadatek"
                detail={checklist.deposit ? `${formatPrice(checklist.deposit.amount)} — ${checklist.deposit.status}` : null}
              />
              <ChecklistItem done={['ready', 'completed'].includes(booking.status)} label="Status" detail={booking.status_label} />
            </List>
          </Paper>

          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Akcje
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                select
                size="small"
                label="Zmień status"
                value={booking.status}
                onChange={(e) =>
                  action(() => api.post(`/admin/bookings/${id}/status`, { status: e.target.value }), 'Status zmieniony')
                }
              >
                {statuses.map((s) => (
                  <MenuItem key={s.code} value={s.code}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>

              <Divider />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!booking.personalization_unlocked_at}
                    onChange={(e) =>
                      action(
                        () => api.post(`/admin/bookings/${id}/personalization-unlock`, { unlocked: e.target.checked }),
                        e.target.checked
                          ? 'Personalizacja odblokowana — klient może ją edytować mimo blokady terminowej'
                          : 'Personalizacja ponownie zablokowana'
                      )
                    }
                  />
                }
                label="Odblokuj personalizację (mimo blokady terminowej)"
              />
              <Typography variant="caption" color="text.secondary">
                {booking.personalization_unlocked_at
                  ? 'Klient może edytować personalizację, nawet jeśli do imprezy zostało mniej dni niż wynosi blokada.'
                  : 'Personalizacja blokuje się automatycznie na kilka dni przed imprezą. Włącz, aby pozwolić klientowi na zmiany mimo to.'}
              </Typography>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Zadatek
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Wyliczony zadatek: <strong>{formatPrice(booking.deposit_amount)}</strong>
              {checklist.deposit?.status === 'paid' && (
                <> • wpłacono: <strong>{formatPrice(checklist.deposit.amount)}</strong></>
              )}
            </Typography>
            {!checklist.deposit_paid ? (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Wpłacona kwota (zł)"
                  size="small"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  helperText="Klienci czasem wpłacają inną kwotę — wpisz faktyczną"
                />
                <Button
                  variant="contained"
                  color="success"
                  sx={{ height: 40 }}
                  onClick={() =>
                    action(
                      () => api.post(`/admin/bookings/${id}/deposit-paid`, { amount: Number(depositAmount) || undefined }),
                      'Zadatek oznaczony — klient otrzyma e-mail z potwierdzeniem'
                    )
                  }
                >
                  Zadatek wpłacony ✓
                </Button>
              </Stack>
            ) : (
              <Button
                variant="outlined"
                color="warning"
                onClick={() =>
                  action(
                    () => api.post(`/admin/bookings/${id}/deposit-unpaid`),
                    'Cofnięto oznaczenie wpłaty (bez e-maila do klienta)'
                  )
                }
              >
                Cofnij oznaczenie wpłaty
              </Button>
            )}
          </Paper>

          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Wpłaty i rozliczenie
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Razem do zapłaty</Typography>
                <Typography fontWeight={600}>{formatPrice(booking.total_price)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Łącznie zapłacono</Typography>
                <Typography fontWeight={700} color="success.main">{formatPrice(booking.paid_amount)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Pozostało do zapłaty</Typography>
                <Typography fontWeight={700} color={Number(booking.remaining_amount) > 0 ? 'warning.main' : 'success.main'}>
                  {formatPrice(booking.remaining_amount)}
                </Typography>
              </Stack>
            </Stack>

            {booking.payments?.length > 0 && (
              <List dense disablePadding sx={{ mb: 1 }}>
                {booking.payments.map((p) => (
                  <ListItem
                    key={p.id}
                    disableGutters
                    secondaryAction={
                      <Button size="small" color="error" onClick={() =>
                        action(() => api.delete(`/admin/bookings/${id}/payment/${p.id}`), 'Wpłata usunięta')
                      }>
                        Usuń
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={`${{ deposit: 'Zadatek', final: 'Dopłata', other: 'Wpłata' }[p.type] || 'Wpłata'} — ${formatPrice(p.amount)}`}
                      secondary={`${p.status === 'paid' ? 'opłacono' : p.status}${p.paid_at ? ' • ' + formatDateTime(p.paid_at) : ''}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Kwota wpłaty (zł)"
                size="small"
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment((s) => ({ ...s, amount: e.target.value }))}
              />
              <TextField
                select
                size="small"
                label="Rodzaj"
                value={newPayment.type}
                onChange={(e) => setNewPayment((s) => ({ ...s, type: e.target.value }))}
                sx={{ minWidth: 130 }}
              >
                <MenuItem value="final">Dopłata (reszta)</MenuItem>
                <MenuItem value="deposit">Zadatek</MenuItem>
                <MenuItem value="other">Inna</MenuItem>
              </TextField>
              <Button
                variant="contained"
                color="success"
                sx={{ height: 40 }}
                disabled={!(Number(newPayment.amount) > 0)}
                onClick={() =>
                  action(async () => {
                    await api.post(`/admin/bookings/${id}/payment`, {
                      amount: Number(newPayment.amount),
                      type: newPayment.type,
                    });
                    setNewPayment({ amount: '', type: 'final' });
                  }, 'Wpłata dodana')
                }
              >
                Dodaj wpłatę
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Galeria po imprezie
            </Typography>
            <TextField
              label="Link Google Drive do galerii"
              fullWidth
              size="small"
              value={gallery.link}
              onChange={(e) => setGallery((g) => ({ ...g, link: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox checked={gallery.askReview} onChange={(e) => setGallery((g) => ({ ...g, askReview: e.target.checked }))} />
              }
              label="Wysyłaj prośbę o opinię"
            />
            <Button
              variant="contained"
              fullWidth
              disabled={!gallery.link}
              onClick={() =>
                action(
                  () => api.post(`/admin/bookings/${id}/gallery`, { gallery_link: gallery.link, ask_review: gallery.askReview }),
                  'E-mail z galerią zakolejkowany'
                )
              }
            >
              Wyślij galerię klientowi
            </Button>
            {booking.gallery_sent_at && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Ostatnio wysłano: {formatDateTime(booking.gallery_sent_at)}
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <ContractSigning bookingId={id} />
        </Grid>

        <Grid item xs={12}>
          <ChatPanel bookingId={id} admin />
        </Grid>
      </Grid>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Usunąć rezerwację #{booking.id}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Tej operacji nie można cofnąć. Usunięte zostaną również personalizacja, umowy, płatności,
            historia i wiadomości tej rezerwacji. Klient otrzyma e-mail o usunięciu rezerwacji.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Anuluj</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              action(async () => {
                await api.delete(`/admin/bookings/${id}`);
                navigate('/admin/rezerwacje');
              }, 'Rezerwacja usunięta')
            }
          >
            Usuń rezerwację
          </Button>
        </DialogActions>
      </Dialog>

      <ImagePreviewDialog open={!!imagePreview} src={imagePreview?.src} title={imagePreview?.title} onClose={() => setImagePreview(null)} />
      <YouTubeDialog open={!!videoPreview} url={videoPreview?.url} title={videoPreview?.title} onClose={() => setVideoPreview(null)} />

      {/* Dialog: pełna edycja rezerwacji */}
      <Dialog open={!!editBooking} onClose={() => setEditBooking(null)} fullWidth maxWidth="md">
        <DialogTitle>Edytuj rezerwację #{booking.id}</DialogTitle>
        <DialogContent>
          {editBooking && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6} sm={3}>
                <TextField label="Data imprezy" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
                  value={editBooking.event_date} onChange={(e) => setEditBooking((s) => ({ ...s, event_date: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Godzina startu" type="time" fullWidth size="small" InputLabelProps={{ shrink: true }}
                  value={editBooking.start_time} onChange={(e) => setEditBooking((s) => ({ ...s, start_time: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField select label="Pakiet" fullWidth size="small" value={editBooking.package_id}
                  onChange={(e) => {
                    const pkg = packages.find((p) => p.id === Number(e.target.value));
                    const price = pkg?.prices?.find((pr) => Number(pr.year) === Number(String(editBooking.event_date).slice(0, 4)));
                    setEditBooking((s) => ({
                      ...s,
                      package_id: Number(e.target.value),
                      duration_hours: pkg?.duration_hours ?? s.duration_hours,
                      package_price: price?.price ?? s.package_price,
                    }));
                  }}>
                  {packages.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Czas trwania (h)" type="number" fullWidth size="small"
                  value={editBooking.duration_hours} onChange={(e) => setEditBooking((s) => ({ ...s, duration_hours: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField label="Nazwa obiektu" fullWidth size="small"
                  value={editBooking.venue_name} onChange={(e) => setEditBooking((s) => ({ ...s, venue_name: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField label="Adres imprezy" fullWidth size="small"
                  value={editBooking.venue_address} onChange={(e) => setEditBooking((s) => ({ ...s, venue_address: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="Km (rozliczane)" type="number" fullWidth size="small"
                  value={editBooking.distance_km} onChange={(e) => setEditBooking((s) => ({ ...s, distance_km: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField select label="Typ imprezy" fullWidth size="small" value={editBooking.event_type}
                  onChange={(e) => setEditBooking((s) => ({ ...s, event_type: e.target.value }))}>
                  {EVENT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="Liczba osób" type="number" fullWidth size="small"
                  value={editBooking.guests_count} onChange={(e) => setEditBooking((s) => ({ ...s, guests_count: e.target.value }))} />
              </Grid>

              <Grid item xs={12}>
                <Divider>Wycena (suma i zadatek przeliczane automatycznie)</Divider>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Cena pakietu (zł)" type="number" fullWidth size="small"
                  value={editBooking.package_price} onChange={(e) => setEditBooking((s) => ({ ...s, package_price: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Transport (zł)" type="number" fullWidth size="small"
                  value={editBooking.transport_cost} onChange={(e) => setEditBooking((s) => ({ ...s, transport_cost: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField select label="Księga gości" fullWidth size="small" value={editBooking.guestbook}
                  onChange={(e) => setEditBooking((s) => ({ ...s, guestbook: e.target.value }))}>
                  <MenuItem value="none">brak</MenuItem>
                  <MenuItem value="standard">standardowa</MenuItem>
                  <MenuItem value="personalized">personalizowana</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Cena księgi (zł)" type="number" fullWidth size="small"
                  value={editBooking.guestbook_price} onChange={(e) => setEditBooking((s) => ({ ...s, guestbook_price: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Rabat (zł)" type="number" fullWidth size="small"
                  value={editBooking.discount_amount} onChange={(e) => setEditBooking((s) => ({ ...s, discount_amount: e.target.value }))} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label="Zadatek (%)" type="number" fullWidth size="small"
                  value={editBooking.deposit_percent} onChange={(e) => setEditBooking((s) => ({ ...s, deposit_percent: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Nowa suma: <strong>{formatPrice(editTotal)}</strong> • zadatek:{' '}
                  <strong>{formatPrice((editTotal * Number(editBooking.deposit_percent || 0)) / 100)}</strong>
                </Alert>
              </Grid>
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  Po istotnych zmianach (termin, pakiet, cena) użyj „Wygeneruj umowę ponownie", aby umowa odzwierciedlała nowe warunki.
                </Alert>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditBooking(null)}>Anuluj</Button>
          <Button variant="contained" onClick={saveBookingEdit}>Zapisz zmiany</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: edycja danych klienta */}
      <Dialog open={!!editClient} onClose={() => setEditClient(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edytuj dane klienta</DialogTitle>
        <DialogContent>
          {editClient && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6}>
                <TextField label="Imię" fullWidth size="small" value={editClient.first_name}
                  onChange={(e) => setEditClient((s) => ({ ...s, first_name: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Nazwisko" fullWidth size="small" value={editClient.last_name}
                  onChange={(e) => setEditClient((s) => ({ ...s, last_name: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="E-mail" fullWidth size="small" value={editClient.email}
                  onChange={(e) => setEditClient((s) => ({ ...s, email: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Telefon" fullWidth size="small" value={editClient.phone}
                  onChange={(e) => setEditClient((s) => ({ ...s, phone: e.target.value }))} />
              </Grid>
              <Grid item xs={12}>
                <TextField select label="Typ klienta" fullWidth size="small" value={editClient.type}
                  onChange={(e) => setEditClient((s) => ({ ...s, type: e.target.value }))}>
                  <MenuItem value="private">Osoba prywatna</MenuItem>
                  <MenuItem value="company">Firma</MenuItem>
                </TextField>
              </Grid>
              {editClient.type === 'company' ? (
                <>
                  <Grid item xs={6}>
                    <TextField label="NIP" fullWidth size="small" value={editClient.nip}
                      onChange={(e) => setEditClient((s) => ({ ...s, nip: e.target.value }))} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Nazwa firmy" fullWidth size="small" value={editClient.company_name}
                      onChange={(e) => setEditClient((s) => ({ ...s, company_name: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Adres firmy" fullWidth size="small" value={editClient.company_address}
                      onChange={(e) => setEditClient((s) => ({ ...s, company_address: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Osoba reprezentująca" fullWidth size="small" value={editClient.representative}
                      onChange={(e) => setEditClient((s) => ({ ...s, representative: e.target.value }))} />
                  </Grid>
                </>
              ) : (
                <>
                  <Grid item xs={6}>
                    <TextField label="Ulica" fullWidth size="small" value={editClient.street}
                      onChange={(e) => setEditClient((s) => ({ ...s, street: e.target.value }))} />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField label="Nr domu" fullWidth size="small" value={editClient.house_no}
                      onChange={(e) => setEditClient((s) => ({ ...s, house_no: e.target.value }))} />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField label="Nr lokalu" fullWidth size="small" value={editClient.apartment_no}
                      onChange={(e) => setEditClient((s) => ({ ...s, apartment_no: e.target.value }))} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Kod pocztowy" fullWidth size="small" value={editClient.postal_code}
                      onChange={(e) => setEditClient((s) => ({ ...s, postal_code: e.target.value }))} />
                  </Grid>
                  <Grid item xs={8}>
                    <TextField label="Miejscowość" fullWidth size="small" value={editClient.city}
                      onChange={(e) => setEditClient((s) => ({ ...s, city: e.target.value }))} />
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditClient(null)}>Anuluj</Button>
          <Button variant="contained" onClick={saveClientEdit}>Zapisz dane klienta</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
