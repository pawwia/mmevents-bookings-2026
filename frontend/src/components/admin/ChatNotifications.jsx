import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Box, Divider, IconButton, ListItemText, Menu, MenuItem, Tooltip, Typography,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { api } from '../../api/client';
import { formatDate } from '../../utils/format';

const POLL_MS = 45000; // odświeżanie liczby nieprzeczytanych co 45 s

/**
 * Dymek czatu w nagłówku CRM. Pokazuje liczbę rozmów z nieprzeczytanymi wiadomościami,
 * a po kliknięciu rozwija listę — która rezerwacja, od kogo, fragment treści.
 * Kliknięcie pozycji przenosi do szczegółów rezerwacji (gdzie jest panel czatu).
 */
export default function ChatNotifications() {
  const [threads, setThreads] = useState([]);
  const [anchor, setAnchor] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/chat');
      setThreads((data.threads || []).filter((t) => Number(t.unread) > 0));
    } catch {
      /* ciche — dymek nie może wywalić CRM */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const open = (e) => {
    setAnchor(e.currentTarget);
    load(); // świeże dane przy otwarciu
  };
  const close = () => setAnchor(null);

  const goTo = (bookingId) => {
    close();
    navigate(`/admin/rezerwacje/${bookingId}`);
  };

  const count = threads.length;

  return (
    <>
      <Tooltip title={count ? `Nieprzeczytane wiadomości: ${count}` : 'Brak nowych wiadomości'}>
        <IconButton onClick={open} sx={{ mr: 1 }} aria-label="Wiadomości czatu">
          <Badge badgeContent={count} color="error">
            <ChatBubbleOutlineIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: '90vw', maxHeight: 420 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">Nieprzeczytane wiadomości</Typography>
        </Box>
        <Divider />

        {count === 0 && (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Wszystko przeczytane 🎉
            </Typography>
          </Box>
        )}

        {threads.map((t) => (
          <MenuItem key={t.id} onClick={() => goTo(t.booking_id)} sx={{ alignItems: 'flex-start', py: 1 }}>
            <Badge color="error" variant="dot" sx={{ mt: 1, mr: 1.5, ml: 0.5 }} />
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    Rez. #{t.booking_id} · {t.first_name} {t.last_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {t.event_date ? formatDate(t.event_date) : ''}
                  </Typography>
                </Box>
              }
              secondary={
                <>
                  <Typography variant="caption" color="text.primary" component="span" sx={{ display: 'block' }} noWrap>
                    {t.subject}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }} noWrap>
                    {t.last_body}
                  </Typography>
                </>
              }
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
