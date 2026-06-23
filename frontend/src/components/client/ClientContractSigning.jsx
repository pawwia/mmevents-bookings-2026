import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import GavelIcon from '@mui/icons-material/GavelOutlined';
import SmsIcon from '@mui/icons-material/SmsOutlined';
import { api, apiError } from '../../api/client';
import ContractPreviewDialog from '../common/ContractPreviewDialog';

/**
 * Panel klienta — ETAP 2 podpisu umowy.
 * Klient musi przewinąć umowę do końca → „Zapoznałem się z treścią umowy" → „Wyślij kod SMS" → OTP.
 */
export default function ClientContractSigning({ bookingId }) {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(false);
  const [readConfirmed, setReadConfirmed] = useState(false);
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false); // fail-closed do potwierdzenia z serwera
  const [signer, setSigner] = useState({ first_name: '', last_name: '' });

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/bookings/${bookingId}/contract`)
      .then(({ data }) => {
        setContract(data.contract);
        if (typeof data.email_verified === 'boolean') setEmailVerified(data.email_verified);
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(load, [load]);

  // Stan weryfikacji e-maila + dane osoby podpisującej (prefill z konta).
  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setEmailVerified(!!data.user.email_verified);
      setSigner({ first_name: data.user.first_name || '', last_name: data.user.last_name || '' });
    });
  }, []);

  const resendVerification = () =>
    run(() => api.post('/auth/resend-verification'), 'Wysłaliśmy ponownie link aktywacyjny na Twój adres e-mail.').catch(() => {});

  const run = async (fn, okMsg) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      if (okMsg) setMessage({ severity: 'success', text: okMsg });
      return res;
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const confirmRead = () =>
    run(() => api.post(`/bookings/${bookingId}/contract/confirm-read`))
      .then(() => {
        setReadConfirmed(true);
        setPreview(false);
      })
      .catch(() => {});

  const sendCode = () =>
    run(() => api.post(`/bookings/${bookingId}/contract/send-code`, signer))
      .then((res) => {
        setOtpStage(true);
        setMessage({ severity: 'info', text: `Kod SMS wysłany na numer ${res?.data?.phone || ''}` });
      })
      .catch(() => {});

  const verifyCode = () =>
    run(() => api.post(`/bookings/${bookingId}/contract/verify-code`, { code: otp }), 'Dziękujemy! Umowa została podpisana.')
      .then(() => {
        setOtp('');
        setOtpStage(false);
        load();
      })
      .catch(() => {});

  if (loading || !contract) return null; // brak umowy do podpisu — sekcja ukryta

  // Klient podpisuje gdy właściciel już podpisał
  const awaitingClient = ['owner_signed', 'pending_client'].includes(contract.signing_status);
  const signed = contract.signing_status === 'fully_signed';

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <GavelIcon color="primary" />
        <Typography variant="h6">Umowa {contract.number}</Typography>
        {signed && <Chip size="small" color="success" label="Podpisana" />}
      </Stack>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {signed && (
        <Alert severity="success">
          Umowa została podpisana przez obie strony. Podpisany dokument wysłaliśmy na Twój adres e-mail.
        </Alert>
      )}

      {!signed && !awaitingClient && (
        <Alert severity="info">Umowa jest przygotowywana. Powiadomimy Cię, gdy będzie gotowa do podpisu.</Alert>
      )}

      {!signed && awaitingClient && !emailVerified && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" disabled={busy} onClick={resendVerification}>
              Wyślij ponownie link
            </Button>
          }
        >
          Aby podpisać umowę, najpierw potwierdź swój adres e-mail. Link aktywacyjny wysłaliśmy podczas zakładania konta.
        </Alert>
      )}

      {!signed && awaitingClient && emailVerified && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Aby podpisać umowę, zapoznaj się z jej treścią (przewiń do końca), a następnie potwierdź podpis kodem SMS.
          </Typography>

          <Box>
            <Button variant="contained" onClick={() => setPreview(true)}>
              Wyświetl i przeczytaj umowę
            </Button>
            {readConfirmed && (
              <Chip size="small" color="success" label="Zapoznano się z treścią" sx={{ ml: 1 }} />
            )}
          </Box>

          {readConfirmed && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'pink.light' }}>
              {!otpStage ? (
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Podaj imię i nazwisko osoby podpisującej umowę:
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      label="Imię"
                      size="small"
                      value={signer.first_name}
                      onChange={(e) => setSigner((s) => ({ ...s, first_name: e.target.value }))}
                    />
                    <TextField
                      label="Nazwisko"
                      size="small"
                      value={signer.last_name}
                      onChange={(e) => setSigner((s) => ({ ...s, last_name: e.target.value }))}
                    />
                  </Stack>
                  <Box>
                    <Button
                      variant="contained"
                      startIcon={<SmsIcon />}
                      disabled={busy || !emailVerified || !signer.first_name.trim() || !signer.last_name.trim()}
                      onClick={sendCode}
                    >
                      Wyślij kod SMS
                    </Button>
                  </Box>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <TextField
                    label="Kod SMS (6 cyfr)"
                    size="small"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                    sx={{ width: 160 }}
                  />
                  <Button variant="contained" disabled={busy || otp.length !== 6} onClick={verifyCode}>
                    Podpisz umowę
                  </Button>
                  <Button size="small" onClick={sendCode} disabled={busy}>
                    Wyślij ponownie
                  </Button>
                </Stack>
              )}
            </Paper>
          )}
        </Stack>
      )}

      <ContractPreviewDialog
        open={preview}
        previewUrl={contract.preview_url}
        title={`Umowa ${contract.number}`}
        onClose={() => setPreview(false)}
        onConfirm={confirmRead}
        confirming={busy}
      />
    </Paper>
  );
}
