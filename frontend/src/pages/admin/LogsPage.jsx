import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/SendOutlined';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import { api, apiError } from '../../api/client';
import { formatDateTime } from '../../utils/format';

const STATUS_COLOR = { pending: 'warning', sent: 'success', failed: 'error' };

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
  const [tab, setTab] = useState('email');
  const [rows, setRows] = useState([]);
  const [systemLog, setSystemLog] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(() => {
    api.get('/admin/logs').then(({ data }) => setOverview(data));
  }, []);

  const loadTab = useCallback(() => {
    if (tab === 'email') api.get('/admin/logs/emails').then(({ data }) => setRows(data));
    else if (tab === 'sms') api.get('/admin/logs/sms').then(({ data }) => setRows(data));
    else api.get('/admin/logs/system', { params: { file: tab === 'cron' ? 'cron' : 'php' } }).then(({ data }) => setSystemLog(data));
  }, [tab]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    loadTab();
  }, [loadTab]);

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

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="E-mail" value="email" />
        <Tab label="SMS" value="sms" />
        <Tab label="Log systemowy" value="php" />
        <Tab label="Log cron" value="cron" />
      </Tabs>

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
