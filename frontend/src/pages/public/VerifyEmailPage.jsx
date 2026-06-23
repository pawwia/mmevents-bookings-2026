import { useEffect, useRef, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailReadOutlined';
import { api, apiError } from '../../api/client';

/** Aktywacja konta po kliknięciu w link z e-maila: /weryfikacja/:token */
export default function VerifyEmailPage() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [error, setError] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return; // raz (StrictMode w dev wywołuje efekt dwukrotnie)
    sent.current = true;
    api
      .post('/auth/verify', { token })
      .then(() => setStatus('ok'))
      .catch((e) => {
        setError(apiError(e));
        setStatus('error');
      });
  }, [token]);

  return (
    <Paper sx={{ p: 5, textAlign: 'center', maxWidth: 520, mx: 'auto', mt: 4 }}>
      {status === 'loading' && <CircularProgress />}
      {status === 'ok' && (
        <Box>
          <MarkEmailReadIcon sx={{ fontSize: 64, color: 'success.main' }} />
          <Typography variant="h5" sx={{ my: 2 }}>
            Adres e-mail potwierdzony 🎉
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Twoje konto jest aktywne. Możesz już podpisać umowę i zarządzać rezerwacją.
          </Typography>
          <Button component={RouterLink} to="/konto" variant="contained">
            Przejdź do panelu klienta
          </Button>
        </Box>
      )}
      {status === 'error' && (
        <Box>
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Zaloguj się i wyślij link aktywacyjny ponownie z panelu klienta.
          </Typography>
          <Button component={RouterLink} to="/logowanie" variant="contained">
            Przejdź do logowania
          </Button>
        </Box>
      )}
    </Paper>
  );
}
