import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Grid, Link, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/SendOutlined';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import { api, apiError } from '../../api/client';
import { formatDateTime } from '../../utils/format';

const STATUS_COLOR = { pending: 'warning', sent: 'success', failed: 'error' };

/** Opis i kolor zdarzeń dziennika aktywności. */
const EVENT_META = {
  // Konta i logowanie
  account_created: { label: 'Nowe konto', color: 'success' },
  login_ok: { label: 'Logowanie OK', color: 'success' },
  login_fail: { label: 'Błędne logowanie', color: 'warning' },
  login_blocked: { label: 'Logowanie zablokowane', color: 'error' },
  email_verified: { label: 'E-mail potwierdzony', color: 'success' },
  profile_updated: { label: 'Zmiana danych', color: 'default' },
  password_changed: { label: 'Hasło zmienione (panel)', color: 'info' },
  // Reset hasła
  reset_request: { label: 'Prośba o reset hasła', color: 'info' },
  reset_blocked: { label: 'Reset zablokowany', color: 'error' },
  reset_done: { label: 'Hasło zresetowane', color: 'success' },
  reset_fail: { label: 'Reset — zły/wygasły link', color: 'warning' },
  // Rezerwacje / personalizacja
  booking_created: { label: 'Nowa rezerwacja', color: 'success' },
  offer_accepted: { label: 'Akceptacja oferty', color: 'success' },
  personalization_update: { label: 'Zmiana personalizacji', color: 'default' },
  // Płatności
  payment_started: { label: 'Rozpoczęto płatność', color: 'info' },
  payment_confirmed: { label: 'Płatność potwierdzona', color: 'success' },
  payment_failed: { label: 'Płatność nieudana', color: 'error' },
  // Czat
  chat_message: { label: 'Wiadomość (klient)', color: 'info' },
  chat_message_admin: { label: 'Wiadomość (admin)', color: 'default' },
  // Akcje admina
  admin_status_change: { label: 'Admin: zmiana statusu', color: 'default' },
  admin_deposit_paid: { label: 'Admin: zadatek wpłacony', color: 'success' },
  admin_deposit_unpaid: { label: 'Admin: cofnięto zadatek', color: 'warning' },
  admin_payment_added: { label: 'Admin: dodano wpłatę', color: 'success' },
  admin_payment_deleted: { label: 'Admin: usunięto wpłatę', color: 'warning' },
  admin_gallery_sent: { label: 'Admin: wysłano galerię', color: 'info' },
  admin_booking_deleted: { label: 'Admin: usunięto rezerwację', color: 'error' },
};

function QueueStat({ label, snap }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Chip size="small" color="warning" label={`oczekuje: ${snap.pending}`} />
        <Chip size="small" color="success" label={`wysłane: ${snap.sent}`} />
        <Chip size="small" color="error" label={`błędy: ${snap.failed}`} />
      </Stack>
    </Paper>
  );
}

export default function LogsPage() {
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState('activity');
  const [rows, setRows] = useState([]);
  const [systemLog, setSystemLog] = useState(null);
  const [activity, setActivity] = useState([]);
  const [actEvent, setActEvent] = useState('');
  const [actQuery, setActQuery] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(() => {
    api.get('/admin/logs').then(({ data }) => setOverview(data));
  }, []);

  const loadActivity = useCallback(() => {
    api
      .get('/admin/logs/activity', { params: { event: actEvent || undefined, q: actQuery || undefined } })
      .then(({ data }) => setActivity(data.rows || []));
  }, [actEvent, actQuery]);

  const loadTab = useCallback(() => {
    if (tab === 'email') api.get('/admin/logs/emails').then(({ data }) => setRows(data));
    else if (tab === 'sms') api.get('/admin/logs/sms').then(({ data }) => setRows(data));
    else if (tab === 'activity') loadActivity();
    else api.get('/admin/logs/system', { params: { file: tab === 'cron' ? 'cron' : 'php' } }).then(({ data }) => setSystemLog(data));
  }, [tab, loadActivity]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    loadTab();
  }, [tab, actEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const processNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await api.post('/admin/logs/process-queue');
      setMessage({
        severity: 'success',
        text: `Wysłano: e-mail ${data.email.sent}/${data.email.processed}, SMS ${data.sms.sent}/${data.sms.processed}. Błędy: e-mail ${data.email.failed}, SMS ${data.sms.failed}.`,
      });
      loadOverview();
      loadTab();
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    } finally {
      setBusy(false);
    }
  };

  const retryFailed = async (type) => {
    await api.post('/admin/logs/retry-failed', { type });
    loadOverview();
    loadTab();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Logi i kolejki</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} onClick={() => { loadOverview(); loadTab(); }}>
            Odśwież
          </Button>
          <Button variant="contained" startIcon={<SendIcon />} disabled={busy} onClick={processNow}>
            Wyślij kolejkę teraz
          </Button>
        </Stack>
      </Stack>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {overview && (
        <>
          {/* Diagnostyka konfiguracji */}
          {(!overview.config.brevo_api_key_set || overview.email.pending > 0) && (
            <Alert severity={overview.config.brevo_api_key_set ? 'info' : 'warning'} sx={{ mb: 2 }}>
              {!overview.config.brevo_api_key_set
                ? 'Brak klucza Brevo API (Ustawienia → Brevo) — e-maile nie zostaną wysłane.'
                : overview.email.pending > 0
                  ? `${overview.email.pending} e-maili czeka w kolejce. Jeśli stoją mimo upływu czasu — cron wysyłki nie działa. Kliknij „Wyślij kolejkę teraz", aby wysłać ręcznie i zweryfikować konfigurację.`
                  : null}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <QueueStat label="Kolejka e-mail (Brevo)" snap={overview.email} />
            </Grid>
            <Grid item xs={12} md={6}>
              <QueueStat label="Kolejka SMS (SMSAPI)" snap={overview.sms} />
            </Grid>
          </Grid>
        </>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        <Tab label="Aktywność" value="activity" />
        <Tab label="E-mail" value="email" />
        <Tab label="SMS" value="sms" />
        <Tab label="Log systemowy" value="php" />
        <Tab label="Log cron" value="cron" />
      </Tabs>

      {tab === 'activity' && (
        <Paper>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); loadActivity(); }} sx={{ p: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select size="small" label="Zdarzenie" value={actEvent}
              onChange={(e) => setActEvent(e.target.value)} sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Wszystkie</MenuItem>
              {Object.entries(EVENT_META).map(([k, m]) => (
                <MenuItem key={k} value={k}>{m.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" label="Szukaj (e-mail / IP / opis)" value={actQuery}
              onChange={(e) => setActQuery(e.target.value)} sx={{ minWidth: 240 }}
            />
            <Button type="submit" variant="outlined">Szukaj</Button>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Kiedy</TableCell>
                <TableCell>Zdarzenie</TableCell>
                <TableCell>E-mail / klient</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>Szczegóły</TableCell>
                <TableCell>Rezerwacja</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activity.map((r) => {
                const meta = EVENT_META[r.event] || { label: r.event, color: 'default' };
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</TableCell>
                    <TableCell><Chip size="small" color={meta.color} label={meta.label} /></TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {r.email || '—'}
                      {(r.first_name || r.last_name) && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {r.first_name} {r.last_name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{r.ip || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.detail || '—'}</TableCell>
                    <TableCell>
                      {r.booking_id ? (
                        <Link component={RouterLink} to={`/admin/rezerwacje/${r.booking_id}`}>#{r.booking_id}</Link>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {activity.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                      Brak zdarzeń dla wybranego filtra.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {(tab === 'email' || tab === 'sms') && (
        <Paper>
          {rows.some((r) => r.status === 'failed') && (
            <Box sx={{ p: 1.5 }}>
              <Button size="small" color="warning" startIcon={<ReplayIcon />} onClick={() => retryFailed(tab)}>
                Ponów nieudane
              </Button>
            </Box>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Odbiorca</TableCell>
                <TableCell>Treść</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Próby</TableCell>
                <TableCell>Błąd</TableCell>
                <TableCell>Utworzono / wysłano</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.target}</TableCell>
                  <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS_COLOR[r.status] || 'default'} label={r.status} />
                  </TableCell>
                  <TableCell>{r.attempts}</TableCell>
                  <TableCell sx={{ maxWidth: 280, color: 'error.main', fontSize: 12 }}>{r.last_error || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {formatDateTime(r.created_at)}
                    {r.sent_at && <> → {formatDateTime(r.sent_at)}</>}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      Kolejka pusta.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {(tab === 'php' || tab === 'cron') && (
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e' }}>
          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
            {systemLog?.file} {systemLog?.note ? `— ${systemLog.note}` : ''}
          </Typography>
          <Box
            component="pre"
            sx={{ m: 0, mt: 1, color: '#E5E7EB', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto' }}
          >
            {(systemLog?.lines || []).join('\n') || '(pusto)'}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
