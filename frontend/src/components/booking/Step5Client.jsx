import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Divider, Grid, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { api, apiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useBookingWizard } from '../../store/bookingWizardStore';
import { PASSWORD_HINT, isStrongPassword } from '../../utils/password';
import GoogleLoginButton from '../common/GoogleLoginButton';
import WizardNav from './WizardNav';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RULES = {
  required: { required: 'To pole jest wymagane' },
  phone: {
    required: 'To pole jest wymagane',
    pattern: { value: /^\+?[0-9 \-]{7,20}$/, message: 'Nieprawidłowy numer telefonu' },
  },
  postal: {
    required: 'To pole jest wymagane',
    pattern: { value: /^\d{2}-\d{3}$/, message: 'Format: 00-000' },
  },
  nip: {
    required: 'To pole jest wymagane',
    pattern: { value: /^[0-9\- ]{10,13}$/, message: 'NIP ma 10 cyfr' },
  },
};

/**
 * KROK 5 — „Twoje dane".
 *
 * Etap logowania (auth): klient podaje e-mail (lub loguje się przez Google).
 *  - e-mail ma już konto  → prosimy o hasło i logujemy (dane uzupełniają się z konta),
 *  - e-mail nowy          → prosimy o hasło z wymaganiami i zakładamy konto.
 * Etap danych (data): formularz danych do faktury/umowy (prefill z konta do poprawki).
 */
export default function Step5Client() {
  const { client, set, next } = useBookingWizard();
  const { token, setAuth } = useAuthStore();
  const [phase, setPhase] = useState(token ? 'data' : 'auth');

  if (phase === 'auth') {
    return <AuthStage onAuthenticated={() => setPhase('data')} setAuth={setAuth} />;
  }
  return <DataStage client={client} token={token} set={set} next={next} />;
}

/** Etap logowania / zakładania konta na podstawie adresu e-mail. */
function AuthStage({ onAuthenticated, setAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState(null); // null → pytamy o e-mail; 'login' | 'register'
  const [googleOnly, setGoogleOnly] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetToEmail = () => {
    setMode(null);
    setPassword('');
    setError('');
    setGoogleOnly(false);
  };

  const checkEmail = async () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(value)) {
      setError('Podaj prawidłowy adres e-mail.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/check-email', { email: value });
      setGoogleOnly(!!data.google_only);
      setMode(data.exists ? 'login' : 'register');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async () => {
    setError('');
    if (mode === 'register' && !isStrongPassword(password)) {
      setError(`Hasło jest za słabe. ${PASSWORD_HINT}.`);
      return;
    }
    if (!password) {
      setError('Podaj hasło.');
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(endpoint, { email: email.trim().toLowerCase(), password });
      setAuth(data);
      onAuthenticated();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      mode ? submitPassword() : checkEmail();
    }
  };

  const googleEnabled = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Twoje dane
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Najpierw zaloguj się lub załóż konto — dzięki temu zarządzisz rezerwacją, umową i personalizacją.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2} sx={{ maxWidth: 440 }}>
        <TextField
          label="Adres e-mail"
          type="email"
          fullWidth
          autoFocus
          value={email}
          disabled={!!mode}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKeyDown}
          InputLabelProps={{ shrink: true }}
        />

        {mode === null && (
          <Button variant="contained" size="large" onClick={checkEmail} disabled={loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Dalej'}
          </Button>
        )}

        {mode === 'login' && (
          <>
            {googleOnly ? (
              <Alert severity="info">
                To konto zostało utworzone przez Google — zaloguj się przyciskiem poniżej.
              </Alert>
            ) : (
              <Alert severity="info">Masz już u nas konto — podaj hasło, aby się zalogować.</Alert>
            )}
            {!googleOnly && (
              <TextField
                label="Hasło"
                type="password"
                fullWidth
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
                InputLabelProps={{ shrink: true }}
              />
            )}
            <Stack direction="row" spacing={1}>
              <Button onClick={resetToEmail} disabled={loading}>
                Zmień e-mail
              </Button>
              {!googleOnly && (
                <Button variant="contained" fullWidth onClick={submitPassword} disabled={loading}>
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Zaloguj się'}
                </Button>
              )}
            </Stack>
          </>
        )}

        {mode === 'register' && (
          <>
            <Alert severity="info">
              Nie znaleźliśmy konta dla tego adresu — ustaw hasło, a założymy je dla Ciebie.
            </Alert>
            <TextField
              label="Ustaw hasło"
              type="password"
              fullWidth
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              helperText={PASSWORD_HINT}
              error={password !== '' && !isStrongPassword(password)}
              InputLabelProps={{ shrink: true }}
            />
            <Stack direction="row" spacing={1}>
              <Button onClick={resetToEmail} disabled={loading}>
                Zmień e-mail
              </Button>
              <Button variant="contained" fullWidth onClick={submitPassword} disabled={loading}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Załóż konto'}
              </Button>
            </Stack>
          </>
        )}

        {googleEnabled && (
          <>
            <Divider>lub</Divider>
            <GoogleLoginButton onSuccess={onAuthenticated} onError={setError} />
          </>
        )}
      </Stack>

      <WizardNav onNext={mode ? submitPassword : checkEmail} nextDisabled={loading} />
    </Box>
  );
}

/** Etap danych do faktury / umowy — prefill z konta, gotowy do poprawki. */
function DataStage({ client, token, set, next }) {
  const [type, setType] = useState(client?.type || 'private');
  const [error, setError] = useState('');
  const [nipLoading, setNipLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm({ mode: 'onBlur', defaultValues: client || { country: 'Polska' } });

  useEffect(() => {
    if (token && !client) {
      api.get('/auth/me').then(({ data }) => {
        reset({
          country: 'Polska',
          ...Object.fromEntries(Object.entries(data.profile || {}).filter(([, v]) => v !== null)),
          first_name: data.user.first_name || '',
          last_name: data.user.last_name || '',
          email: data.user.email,
          phone: data.user.phone || '',
        });
        if (data.profile?.type) setType(data.profile.type);
      });
    }
  }, [token, client, reset]);

  const fieldProps = (name, rules) => ({
    ...register(name, rules),
    error: !!errors[name],
    helperText: errors[name]?.message,
    InputLabelProps: { shrink: true },
  });

  const lookupNip = async () => {
    const nip = getValues('nip');
    if (!nip) return;
    setNipLoading(true);
    setError('');
    try {
      const { data } = await api.get('/nip', { params: { nip } });
      setValue('company_name', data.company_name, { shouldValidate: true });
      setValue('company_address', data.address, { shouldValidate: true });
      if (data.representatives?.[0]) setValue('representative', data.representatives[0], { shouldValidate: true });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setNipLoading(false);
    }
  };

  const onSubmit = (values) => {
    set({ client: { ...values, type } });
    next();
  };

  const onInvalid = () => setError('Uzupełnij wszystkie wymagane pola zaznaczone na czerwono.');

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
      <Typography variant="h6" gutterBottom>
        Twoje dane
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Uzupełnij dane do faktury i umowy. Pola wstępnie wypełniliśmy z Twojego konta — możesz je poprawić.
      </Typography>
      <ToggleButtonGroup value={type} exclusive onChange={(_, v) => v && setType(v)} sx={{ mb: 3 }}>
        <ToggleButton value="private">Osoba prywatna</ToggleButton>
        <ToggleButton value="company">Firma</ToggleButton>
      </ToggleButtonGroup>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Imię *" fullWidth {...fieldProps('first_name', RULES.required)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Nazwisko *" fullWidth {...fieldProps('last_name', RULES.required)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Telefon *" fullWidth {...fieldProps('phone', RULES.phone)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="E-mail" type="email" fullWidth disabled {...register('email')} InputLabelProps={{ shrink: true }} />
        </Grid>

        {type === 'company' ? (
          <>
            <Grid item xs={12} sm={8}>
              <TextField label="NIP *" fullWidth {...fieldProps('nip', RULES.nip)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button onClick={lookupNip} variant="outlined" fullWidth sx={{ height: 56 }} disabled={nipLoading}>
                {nipLoading ? 'Pobieram…' : 'Pobierz dane z GUS'}
              </Button>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Nazwa firmy *" fullWidth {...fieldProps('company_name', RULES.required)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Adres firmy *" fullWidth {...fieldProps('company_address', RULES.required)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Osoba reprezentująca *" fullWidth {...fieldProps('representative', RULES.required)} />
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6}>
              <TextField label="Ulica *" fullWidth {...fieldProps('street', RULES.required)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="Nr domu *" fullWidth {...fieldProps('house_no', RULES.required)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="Nr mieszkania" fullWidth {...register('apartment_no')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="Kod pocztowy *" placeholder="00-000" fullWidth {...fieldProps('postal_code', RULES.postal)} />
            </Grid>
            <Grid item xs={6} sm={5}>
              <TextField label="Miejscowość *" fullWidth {...fieldProps('city', RULES.required)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Kraj" fullWidth {...register('country')} InputLabelProps={{ shrink: true }} />
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <TextField
            label="Uwagi do rezerwacji (opcjonalnie)"
            fullWidth
            multiline
            minRows={2}
            {...register('notes')}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <WizardNav onNext={handleSubmit(onSubmit, onInvalid)} />
    </Box>
  );
}
