import { useEffect, useState } from 'react';
import { Alert, Box, Button, Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { api, apiError } from '../../api/client';

export default function ProfilePage() {
  const { register, handleSubmit, reset } = useForm();
  const passwordForm = useForm();
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      reset({
        first_name: data.user.first_name || '',
        last_name: data.user.last_name || '',
        phone: data.user.phone || '',
        ...Object.fromEntries(Object.entries(data.profile || {}).filter(([, v]) => v !== null)),
      });
    });
  }, [reset]);

  const save = async (values) => {
    setMessage(null);
    try {
      await api.put('/auth/profile', values);
      setMessage({ severity: 'success', text: 'Profil zapisany.' });
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  const changePassword = async (values) => {
    setMessage(null);
    try {
      await api.put('/auth/password', values);
      setMessage({ severity: 'success', text: 'Hasło zmienione.' });
      passwordForm.reset();
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Mój profil
      </Typography>
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Paper sx={{ p: 3, mb: 3 }}>
        <form onSubmit={handleSubmit(save)}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="Imię" fullWidth {...register('first_name')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Nazwisko" fullWidth {...register('last_name')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Telefon" fullWidth {...register('phone')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Ulica" fullWidth {...register('street')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={4} sm={2}>
              <TextField label="Nr domu" fullWidth {...register('house_no')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={4} sm={2}>
              <TextField label="Nr lokalu" fullWidth {...register('apartment_no')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={4} sm={2}>
              <TextField label="Kod" fullWidth {...register('postal_code')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Miejscowość" fullWidth {...register('city')} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>
            Zapisz profil
          </Button>
        </form>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Zmiana hasła
        </Typography>
        <form onSubmit={passwordForm.handleSubmit(changePassword)}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Aktualne hasło" type="password" {...passwordForm.register('current_password')} />
            <TextField label="Nowe hasło (min. 8 znaków)" type="password" required {...passwordForm.register('password')} />
            <Button type="submit" variant="outlined">
              Zmień hasło
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
