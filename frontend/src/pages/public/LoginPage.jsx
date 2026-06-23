import { useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { Paper, Typography, TextField, Button, Alert, Divider, Link, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { api, apiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import GoogleLoginButton from '../../components/common/GoogleLoginButton';
import Turnstile from '../../components/common/Turnstile';

export default function LoginPage() {
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState('');
  const [cfToken, setCfToken] = useState('');
  const [cfRefresh, setCfRefresh] = useState(0);
  const setAuth = useAuthStore((s) => s.setAuth);
  const captchaEnabled = useSettingsStore((s) => !!s.settings['security.turnstile_site_key']);
  const navigate = useNavigate();
  const location = useLocation();

  const afterLogin = (data) => {
    const target = location.state?.from || (data.user.role === 'admin' ? '/admin' : '/konto');
    navigate(target, { replace: true });
  };

  const onSubmit = async (values) => {
    setError('');
    // Zabezpieczenie przed wysłaniem Enterem zanim Turnstile wygeneruje token.
    if (captchaEnabled && !cfToken) {
      setError('Poczekaj chwilę — trwa weryfikacja Cloudflare, za moment będzie można się zalogować.');
      return;
    }
    try {
      const { data } = await api.post('/auth/login', { ...values, cf_token: cfToken });
      setAuth(data);
      afterLogin(data);
    } catch (e) {
      setError(apiError(e));
      // Token Turnstile jest jednorazowy — po nieudanej próbie pobierz świeży na kolejną.
      setCfToken('');
      setCfRefresh((n) => n + 1);
    }
  };

  return (
    <Paper sx={{ maxWidth: 420, mx: 'auto', p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Zaloguj się
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Zarządzaj swoimi rezerwacjami i personalizacją fotolustra.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <TextField label="Adres e-mail" type="email" fullWidth required {...register('email')} />
          <TextField label="Hasło" type="password" fullWidth required {...register('password')} />
          <Turnstile onToken={setCfToken} refreshKey={cfRefresh} />
          <Button type="submit" variant="contained" size="large" fullWidth disabled={captchaEnabled && !cfToken}>
            {captchaEnabled && !cfToken ? 'Weryfikacja Cloudflare…' : 'Zaloguj się'}
          </Button>
        </Stack>
      </form>
      <Divider sx={{ my: 3 }}>lub</Divider>
      <GoogleLoginButton onSuccess={afterLogin} onError={setError} />
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        Nie masz konta?{' '}
        <Link component={RouterLink} to="/rejestracja">
          Zarejestruj się
        </Link>
      </Typography>
    </Paper>
  );
}
