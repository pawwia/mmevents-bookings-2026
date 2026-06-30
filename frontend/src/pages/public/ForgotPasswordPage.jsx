import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailReadOutlined';
import { api, apiError } from '../../api/client';

/** „Nie pamiętam hasła" — krok 1: klient podaje e-mail, wysyłamy link do resetu. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // API zwykle odpowiada sukcesem (antyenumeracja). Wyjątek to np. 429 (za dużo prób) —
      // wtedy pokazujemy komunikat, zamiast zostawiać klienta z „martwym" formularzem.
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Paper sx={{ p: 5, textAlign: 'center', maxWidth: 520, mx: 'auto', mt: 4 }}>
        <MarkEmailReadIcon sx={{ fontSize: 64, color: 'success.main' }} />
        <Typography variant="h5" sx={{ my: 2 }}>
          Sprawdź skrzynkę
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Jeśli dla podanego adresu istnieje konto, wysłaliśmy na nie link do ustawienia nowego hasła.
          Link jest ważny przez 1 godzinę. Sprawdź też folder spam.
        </Typography>
        <Button component={RouterLink} to="/logowanie" variant="contained">
          Wróć do logowania
        </Button>
      </Paper>
    );
  }

  return (
    <Paper sx={{ maxWidth: 420, mx: 'auto', p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Nie pamiętasz hasła?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Podaj adres e-mail przypisany do konta — wyślemy Ci link do ustawienia nowego hasła.
      </Typography>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={onSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Adres e-mail"
            type="email"
            fullWidth
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Wyślij link do resetu'}
          </Button>
        </Stack>
      </Box>
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        <Link component={RouterLink} to="/logowanie">
          Wróć do logowania
        </Link>
      </Typography>
    </Paper>
  );
}
