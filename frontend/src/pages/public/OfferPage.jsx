import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Checkbox, Chip, CircularProgress,
  Divider, FormControlLabel, Grid, Link, List, ListItem, ListItemIcon, ListItemText,
  Paper, Stack, TextField, Typography, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { useForm } from 'react-hook-form';
import { api, apiError } from '../../api/client';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import GoogleLoginButton from '../../components/common/GoogleLoginButton';
import { PASSWORD_HINT, isStrongPassword } from '../../utils/password';
import { formatDate, formatPrice, formatTime } from '../../utils/format';
import { trackPurchase, pushDataLayer } from '../../utils/tracking';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RULES = {
  required: { required: 'To pole jest wymagane' },
  phone: { required: 'To pole jest wymagane', pattern: { value: /^\+?[0-9 \-]{7,20}$/, message: 'Nieprawidłowy numer telefonu' } },
  postal: { required: 'To pole jest wymagane', pattern: { value: /^\d{2}-\d{3}$/, message: 'Format: 00-000' } },
  nip: { required: 'To pole jest wymagane', pattern: { value: /^[0-9\- ]{10,13}$/, message: 'NIP ma 10 cyfr' } },
};

/**
 * Interaktywna strona oferty (/oferta/{token}): klient porównuje warianty cenowe,
 * wybiera jeden, loguje się / zakłada konto (e-mail lub Google — jak w onboardingu),
 * uzupełnia dane do faktury (firma → dane z GUS) → powstaje rezerwacja.
 */
export default function OfferPage() {
  const { token } = useParams();
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .get(`/offers/${token}`)
      .then(({ data }) => setOffer(data))
      .catch((e) => setError(apiError(e)));
  }, [token]);

  if (error && !offer) return <Alert severity="error">{error}</Alert>;
  if (!offer)
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );

  if (result) {
    return (
      <Paper sx={{ p: 5, textAlign: 'center' }}>
        <CelebrationIcon sx={{ fontSize: 64, color: 'primary.main' }} />
        <Typography variant="h5" sx={{ my: 2 }}>
          Dziękujemy! Oferta zaakceptowana 🎉
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          Utworzyliśmy rezerwację <strong>#{result.booking_id}</strong> na kwotę{' '}
          <strong>{formatPrice(result.total_price)}</strong>. Umowa i dane do wpłaty zadatku (
          {formatPrice(result.deposit_amount)}) trafią na Twój e-mail.
        </Typography>
        <Button component={RouterLink} to="/konto" variant="contained" sx={{ mt: 2 }}>
          Przejdź do panelu klienta
        </Button>
      </Paper>
    );
  }

  const unavailable = offer.status === 'accepted' || offer.expired;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Oferta dla: {offer.company_name || offer.client_name}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {offer.event_type}
        {offer.guests_count ? ` • ${offer.guests_count} osób` : ''}
        {offer.event_date ? ` • ${formatDate(offer.event_date)}` : ''}
        {offer.start_time ? `, start ${formatTime(offer.start_time)}` : ''}
        {offer.venue_name || offer.venue_address ? ` • ${offer.venue_name || offer.venue_address}` : ''}
      </Typography>
      {offer.intro && (
        <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'pink.light' }}>
          <Typography sx={{ whiteSpace: 'pre-line' }}>{offer.intro}</Typography>
        </Paper>
      )}
      {offer.expired && <Alert severity="warning" sx={{ mb: 2 }}>Ta oferta wygasła — skontaktuj się z nami po aktualną wycenę.</Alert>}
      {offer.status === 'accepted' && <Alert severity="info" sx={{ mb: 2 }}>Ta oferta została już zaakceptowana. Dziękujemy!</Alert>}
      {offer.valid_until && !offer.expired && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Oferta ważna do <strong>{formatDate(offer.valid_until)}</strong>.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {offer.variants.map((variant) => (
          <Grid item xs={12} sm={6} md={4} key={variant.id}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                borderColor: selectedVariant === variant.id ? 'primary.main' : 'divider',
                borderWidth: selectedVariant === variant.id ? 2 : 1,
                bgcolor: selectedVariant === variant.id ? 'pink.light' : '#fff',
              }}
            >
              <CardActionArea disabled={unavailable} onClick={() => setSelectedVariant(variant.id)} sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6">{variant.name}</Typography>
                  <Typography variant="h5" color="primary.dark" sx={{ fontWeight: 800, my: 1 }}>
                    {formatPrice(variant.price)}
                  </Typography>
                  {variant.duration_hours && <Chip size="small" label={`${Number(variant.duration_hours)} h zabawy`} sx={{ mb: 1 }} />}
                  <List dense disablePadding>
                    {variant.items.map((item) => (
                      <ListItem key={item} disableGutters sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckIcon fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary={item} primaryTypographyProps={{ fontSize: 13 }} />
                      </ListItem>
                    ))}
                  </List>
                  {variant.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {variant.description}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {selectedVariant && !unavailable && (
        <AcceptPanel token={token} variantId={selectedVariant} offer={offer} onResult={setResult} />
      )}
    </Box>
  );
}

/** Panel akceptacji: najpierw logowanie/konto (e-mail lub Google), potem dane do faktury. */
function AcceptPanel({ token, variantId, offer, onResult }) {
  const authToken = useAuthStore((s) => s.token);
  const [phase, setPhase] = useState(authToken ? 'data' : 'auth');

  return (
    <Paper sx={{ p: 3 }}>
      {phase === 'auth' ? (
        <AuthStage onAuthenticated={() => setPhase('data')} />
      ) : (
        <DataStage token={token} variantId={variantId} offer={offer} onResult={onResult} />
      )}
    </Paper>
  );
}

/** Etap logowania / zakładania konta na podstawie adresu e-mail (lub Google). */
function AuthStage({ onAuthenticated }) {
  const setAuth = useAuthStore((s) => s.setAuth);
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
        Zaloguj się, aby zarezerwować
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
              <Alert severity="info">To konto zostało utworzone przez Google — zaloguj się przyciskiem poniżej.</Alert>
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
            <Alert severity="info">Nie znaleźliśmy konta dla tego adresu — ustaw hasło, a założymy je dla Ciebie.</Alert>
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
    </Box>
  );
}

/** Etap danych do faktury / umowy — prefill z konta, firma → dane z GUS, akceptacja oferty. */
function DataStage({ token, variantId, offer, onResult }) {
  const settings = useSettingsStore((s) => s.settings);
  const [type, setType] = useState(offer.company_name ? 'company' : 'private');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [nipLoading, setNipLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm({ mode: 'onBlur', defaultValues: { country: 'Polska' } });

  // Prefill danych z konta klienta (świeżo zalogowanego / założonego).
  useEffect(() => {
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
  }, [reset]);

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

  const onSubmit = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/offers/${token}/accept`, {
        ...values,
        type,
        variant_id: variantId,
        terms_accepted: consent,
      });
      trackPurchase({ id: data.booking_id, value: data.total_price, currency: 'PLN', source: 'offer' });
      // Konwersja „rezerwacja złożona" do GTM — akceptacja oferty również tworzy rezerwację.
      pushDataLayer('booking_confirm', {
        booking_id: data.booking_id,
        value: data.total_price,
        currency: 'PLN',
        source: 'offer',
      });
      onResult(data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = () => setError('Uzupełnij wszystkie wymagane pola zaznaczone na czerwono.');

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
      <Typography variant="h6" gutterBottom>
        Świetny wybór! Uzupełnij dane do umowy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pola wstępnie wypełniliśmy z Twojego konta — możesz je poprawić.
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

      {(!offer.event_date || !offer.start_time || (!offer.venue_name && !offer.venue_address)) && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Uzupełnij dane imprezy
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {!offer.event_date && (
              <Grid item xs={12} sm={4}>
                <TextField type="date" label="Data imprezy *" fullWidth {...fieldProps('event_date', RULES.required)} />
              </Grid>
            )}
            {!offer.start_time && (
              <Grid item xs={12} sm={4}>
                <TextField type="time" label="Godzina startu *" fullWidth {...fieldProps('start_time', RULES.required)} />
              </Grid>
            )}
            {!offer.venue_name && !offer.venue_address && (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField label="Nazwa obiektu" fullWidth {...register('venue_name')} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Adres imprezy *" fullWidth {...fieldProps('venue_address', RULES.required)} />
                </Grid>
              </>
            )}
          </Grid>
        </>
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
      </Grid>

      <Divider sx={{ my: 2 }} />
      <FormControlLabel
        control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
        label={
          <Typography variant="body2">
            Wyrażam zgodę na{' '}
            <Link href={settings['app.privacy_url'] || '/polityka-prywatnosci'} target="_blank" rel="noreferrer">
              politykę prywatności
            </Link>{' '}
            i akceptuję{' '}
            <Link href={settings['app.terms_url'] || '/regulamin'} target="_blank" rel="noreferrer">
              regulamin
            </Link>
            . *
          </Typography>
        }
      />
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" size="large" disabled={!consent || submitting}>
          {submitting ? 'Przetwarzanie…' : 'Akceptuję ofertę i rezerwuję'}
        </Button>
      </Stack>
    </Box>
  );
}
