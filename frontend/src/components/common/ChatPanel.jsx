import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Badge, Box, Button, Chip, Divider, IconButton, List, ListItemButton, ListItemText,
  Paper, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ChatIcon from '@mui/icons-material/ChatBubbleOutline';
import AddIcon from '@mui/icons-material/Add';
import { api, apiError } from '../../api/client';
import { formatDateTime } from '../../utils/format';

/**
 * Mini-czat klient ↔ admin (wspólny dla panelu klienta i CRM).
 * Props: bookingId, admin (bool — czy widok administratora).
 */
export default function ChatPanel({ bookingId, admin = false }) {
  const side = admin ? 'admin' : 'client';
  const paths = {
    threads: admin ? `/admin/chat?booking_id=${bookingId}` : `/bookings/${bookingId}/chat`,
    create: admin ? `/admin/bookings/${bookingId}/chat` : `/bookings/${bookingId}/chat`,
    thread: (tid) => (admin ? `/admin/chat/threads/${tid}` : `/chat/threads/${tid}`),
    message: (tid) => (admin ? `/admin/chat/threads/${tid}/messages` : `/chat/threads/${tid}/messages`),
    attachment: (mid) => (admin ? `/admin/chat/messages/${mid}/attachment` : `/chat/messages/${mid}/attachment`),
  };

  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null); // { thread, messages }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [reply, setReply] = useState('');
  const newFileRef = useRef(null);
  const replyFileRef = useRef(null);

  const loadThreads = useCallback(() => {
    api.get(paths.threads).then(({ data }) => setThreads(data.threads)).catch((e) => setError(apiError(e)));
  }, [paths.threads]);

  useEffect(loadThreads, [loadThreads]);

  const openThread = (tid) =>
    api.get(paths.thread(tid)).then(({ data }) => {
      setActive(data);
      loadThreads(); // odśwież liczniki nieprzeczytanych
    });

  const wrap = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const createThread = () =>
    wrap(async () => {
      const form = new FormData();
      form.append('subject', draft.subject);
      form.append('body', draft.body);
      if (newFileRef.current?.files?.[0]) form.append('file', newFileRef.current.files[0]);
      const { data } = await api.post(paths.create, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setComposing(false);
      setDraft({ subject: '', body: '' });
      if (newFileRef.current) newFileRef.current.value = '';
      loadThreads();
      openThread(data.thread_id);
    });

  const sendReply = () =>
    wrap(async () => {
      const file = replyFileRef.current?.files?.[0];
      if (!reply.trim() && !file) return;
      const form = new FormData();
      form.append('body', reply);
      if (file) form.append('file', file);
      await api.post(paths.message(active.thread.id), form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReply('');
      if (replyFileRef.current) replyFileRef.current.value = '';
      openThread(active.thread.id);
    });

  const openAttachment = async (mid) => {
    try {
      const res = await api.get(paths.attachment(mid), { responseType: 'blob' });
      window.open(URL.createObjectURL(res.data), '_blank', 'noopener');
    } catch (e) {
      setError(apiError(e));
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <ChatIcon color="primary" />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Wiadomości</Typography>
        {!active && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setComposing((v) => !v)}>
            Nowy temat
          </Button>
        )}
        {active && (
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />} onClick={() => setActive(null)}>
            Wątki
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Nowy temat */}
      {!active && composing && (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="Temat"
            size="small"
            value={draft.subject}
            onChange={(e) => setDraft((s) => ({ ...s, subject: e.target.value }))}
            inputProps={{ maxLength: 150 }}
          />
          <TextField
            label="Wiadomość"
            size="small"
            multiline
            minRows={2}
            value={draft.body}
            onChange={(e) => setDraft((s) => ({ ...s, body: e.target.value }))}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button component="label" size="small" startIcon={<AttachFileIcon />}>
              Załącznik
              <input ref={newFileRef} type="file" hidden accept="image/*,application/pdf" />
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained" size="small" disabled={busy || !draft.subject.trim() || !draft.body.trim()} onClick={createThread}>
              Wyślij
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Lista wątków */}
      {!active && (
        <List dense disablePadding>
          {threads.length === 0 && (
            <Typography variant="body2" color="text.secondary">Brak wiadomości. Rozpocznij nowy temat.</Typography>
          )}
          {threads.map((t) => (
            <ListItemButton key={t.id} onClick={() => openThread(t.id)} sx={{ borderRadius: 1, mb: 0.5, border: '1px solid', borderColor: 'divider' }}>
              <Badge color="error" badgeContent={Number(t.unread) || 0} sx={{ mr: 2 }}>
                <ChatIcon fontSize="small" color="action" />
              </Badge>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontWeight: Number(t.unread) ? 700 : 500 }}>{t.subject}</Typography>
                    {admin && t.first_name && <Chip size="small" label={`${t.first_name} ${t.last_name || ''}`} />}
                  </Stack>
                }
                secondary={(t.last_body || '').slice(0, 80) || '(załącznik)'}
              />
              {t.last_message_at && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                  {formatDateTime(t.last_message_at)}
                </Typography>
              )}
            </ListItemButton>
          ))}
        </List>
      )}

      {/* Otwarty wątek */}
      {active && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{active.thread.subject}</Typography>
          <Divider sx={{ mb: 1 }} />
          <Stack spacing={1} sx={{ maxHeight: 360, overflowY: 'auto', mb: 2 }}>
            {active.messages.map((m) => {
              const mine = m.sender === side;
              return (
                <Box key={m.id} sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 1.2, bgcolor: mine ? 'pink.light' : '#F5F6F8', borderColor: 'divider' }}
                  >
                    {m.body && <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{m.body}</Typography>}
                    {m.has_attachment && (
                      <Button size="small" startIcon={<AttachFileIcon />} onClick={() => openAttachment(m.id)} sx={{ mt: m.body ? 0.5 : 0 }}>
                        {m.attachment_name || 'Załącznik'}
                      </Button>
                    )}
                    {m.attachment_removed && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Załącznik usunięty po imprezie
                      </Typography>
                    )}
                  </Paper>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: mine ? 'right' : 'left' }}>
                    {mine ? 'Ty' : m.sender === 'admin' ? 'MMEvents' : 'Klient'} • {formatDateTime(m.created_at)}
                  </Typography>
                </Box>
              );
            })}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              label="Odpowiedz"
              size="small"
              fullWidth
              multiline
              maxRows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <IconButton component="label" disabled={busy}>
              <AttachFileIcon />
              <input ref={replyFileRef} type="file" hidden accept="image/*,application/pdf" />
            </IconButton>
            <Button variant="contained" disabled={busy} onClick={sendReply}>Wyślij</Button>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
