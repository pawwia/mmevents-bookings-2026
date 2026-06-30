import { useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { api, apiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { PASSWORD_HINT, isStrongPassword } from '../../utils/password';

/** „Nie pamiętam hasła" — krok 2: ustawienie nowego hasła z linku: /reset-hasla/:token */
export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isStrongPassword(password)) {
      setError(`Hasło jest za słabe. ${PASSWORD_HINT}.`);
      return;
    }
    if (password !== confirm) {
      setError('Hasła nie są takie same.');
      return;
    }
    setLoading(true);
    try {
      // Po udanym resecie API zwraca token — logujemy klienta od razu.
      const { data } = await api.post('/auth/reset-password', { token, password });
      setAuth(data);
      navigate(data.user.role === 'admin' ? '/admin' : '/konto', { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ maxWidth: 420, mx: 'auto', p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Ustaw nowe hasło
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Wpisz nowe hasło do swojego konta.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={onSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Nowe hasło"
            type="password"
            fullWidth
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText={PASSWORD_HINT}
            error={password !== '' && !isStrongPassword(password)}
          />
          <TextField
            label="Powtórz nowe hasło"
            type="password"
            fullWidth
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={confirm !== '' && confirm !== password}
            helperText={confirm !== '' && confirm !== password ? 'Hasła nie są takie same' : ' '}
          />
          <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Zapisz nowe hasło'}
          </Button>
        </Stack>
      </Box>
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        <Link component={RouterLink} to="/przypomnij-haslo">
          Link wygasł? Poproś o nowy
        </Link>
      </Typography>
    </Paper>
  );
}
