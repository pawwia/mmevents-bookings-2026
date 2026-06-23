import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Paper, Typography, TextField, Button, Alert, Divider, Link, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { api, apiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import GoogleLoginButton from '../../components/common/GoogleLoginButton';
import { PASSWORD_HINT } from '../../utils/password';

export default function RegisterPage() {
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const onSubmit = async (values) => {
    setError('');
    try {
      const { data } = await api.post('/auth/register', values);
      setAuth(data);
      navigate('/konto', { replace: true });
    } catch (e) {
      setError(apiError(e));
    }
  };

  return (
    <Paper sx={{ maxWidth: 460, mx: 'auto', p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Załóż konto
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Konto powstaje też automatycznie podczas pierwszej rezerwacji.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField label="Imię" fullWidth required {...register('first_name')} />
            <TextField label="Nazwisko" fullWidth required {...register('last_name')} />
          </Stack>
          <TextField label="Adres e-mail" type="email" fullWidth required {...register('email')} />
          <TextField label="Telefon" fullWidth {...register('phone')} />
          <TextField label="Hasło" type="password" fullWidth required helperText={PASSWORD_HINT} {...register('password')} />
          <Button type="submit" variant="contained" size="large" fullWidth>
            Zarejestruj się
          </Button>
        </Stack>
      </form>
      <Divider sx={{ my: 3 }}>lub</Divider>
      <GoogleLoginButton onSuccess={() => navigate('/konto')} onError={setError} />
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        Masz już konto?{' '}
        <Link component={RouterLink} to="/logowanie">
          Zaloguj się
        </Link>
      </Typography>
    </Paper>
  );
}
