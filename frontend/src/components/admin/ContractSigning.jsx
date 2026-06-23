import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Link, Paper, Stack, TextField, Typography,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import SmsIcon from '@mui/icons-material/SmsOutlined';
import { api, apiError } from '../../api/client';
import ContractPreviewDialog from '../common/ContractPreviewDialog';
import ContractTimeline from '../common/ContractTimeline';

const SIGNING_LABELS = {
  draft: { label: 'Szkic — do podpisania', color: 'default' },
  pending_owner: { label: 'Oczekuje na podpis właściciela', color: 'warning' },
  owner_signed: { label: 'Podpisana przez właściciela', color: 'info' },
  pending_client: { label: 'Oczekuje na podpis klienta', color: 'info' },
  fully_signed: { label: 'Podpisana przez obie strony', color: 'success' },
  cancelled: { label: 'Wycofana', color: 'error' },
};

/** CRM → sekcja „Podpisywanie umowy". ETAP 1 (właściciel) + generowanie + timeline. */
export default function ContractSigning({ bookingId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(false);
  const [ownerOtp, setOwnerOtp] = useState('');
  const [otpStage, setOtpStage] = useState(false);
  const uploadRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/admin/bookings/${bookingId}/contract`)
      .then(({ data }) => setData(data.contract ? data : { contract: null }))
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(load, [load]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      if (okMsg) setMessage({ severity: 'success', text: okMsg });
      load();
      return res;
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const contract = data?.contract;

  const confirmRead = () =>
    run(() => api.post(`/admin/contracts/${contract.id}/start-signing`), 'Zapoznano się — rozpoczęto proces podpisywania')
      .then(() => setPreview(false))
      .catch(() => {});

  const uploadPdf = async (file) => {
    const form = new FormData();
    form.append('file', file);
    await run(
      () => api.post(`/admin/bookings/${bookingId}/contract/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
      'Wgrano niestandardową umowę PDF'
    ).catch(() => {});
  };

  const sendOwnerCode = () =>
    run(() => api.post(`/admin/contracts/${contract.id}/owner/send-code`)).then((res) => {
      setOtpStage(true);
      setMessage({ severity: 'info', text: `Kod SMS wysłany na numer właściciela ${res?.data?.phone || ''}` });
    }).catch(() => {});

  const verifyOwnerCode = () =>
    run(() => api.post(`/admin/contracts/${contract.id}/owner/verify-code`, { code: ownerOtp }), 'Właściciel podpisał umowę')
      .then(() => {
        setOtpStage(false);
        setOwnerOtp('');
      })
      .catch(() => {});

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Wczytywanie modułu podpisu…</Typography>
      </Paper>
    );
  }

  const status = contract ? SIGNING_LABELS[contract.signing_status] : null;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6">Podpisywanie umowy</Typography>
        {status && <Chip size="small" color={status.color} label={status.label} />}
      </Stack>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Brak umowy — generowanie */}
      {!contract && (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Umowa generowana jest z szablonu (Ustawienia → Podpis umów → Szablon umowy) i składana do PDF lokalnie.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" startIcon={<DescriptionIcon />} disabled={busy}
              onClick={() => run(() => api.post(`/admin/bookings/${bookingId}/contract/standard`), 'Wygenerowano umowę').catch(() => {})}>
              Generuj umowę
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}
              onClick={() => uploadRef.current?.click()}>
              Wgraj umowę niestandardową (PDF)
            </Button>
            <input ref={uploadRef} type="file" accept="application/pdf" hidden
              onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
          </Stack>
        </Stack>
      )}

      {contract && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Umowa <strong>{contract.number}</strong> ({{ standard: 'z szablonu', uploaded: 'wgrana' }[contract.type] || contract.type})
            {contract.document_hash && <> • hash: <code>{contract.document_hash.slice(0, 16)}…</code></>}
          </Typography>

          {/* Link do dokumentu Google Docs (gdy umowa z Apps Script) — do ewentualnej ręcznej edycji */}
          {contract.doc_url && contract.signing_status === 'draft' && (
            <Alert severity="info">
              <Stack spacing={1} alignItems="flex-start">
                <span>Umowa powstała jako kopia szablonu Google Docs. Możesz ją otworzyć i ręcznie poprawić, a potem ponownie wygenerować.</span>
                <Button size="small" variant="outlined" component={Link} href={contract.doc_url} target="_blank" rel="noreferrer">
                  Otwórz dokument w Google Docs
                </Button>
              </Stack>
            </Alert>
          )}

          {/* Akcje na szkicu: podgląd (scroll-gate) + wgranie PDF */}
          {contract.signing_status === 'draft' && (
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button variant="contained" disabled={!contract.has_pdf} onClick={() => setPreview(true)}>
                Podgląd i rozpocznij podpisywanie
              </Button>
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => uploadRef.current?.click()}>
                Wgraj umowę niestandardową
              </Button>
              <input ref={uploadRef} type="file" accept="application/pdf" hidden
                onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
            </Stack>
          )}

          {/* ETAP 1 — podpis właściciela */}
          {contract.signing_status === 'pending_owner' && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'pink.light' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>ETAP 1 — podpis właściciela</Typography>
              {!otpStage ? (
                <Button variant="contained" startIcon={<SmsIcon />} disabled={busy} onClick={sendOwnerCode}>
                  Wyślij do podpisu (kod SMS)
                </Button>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField label="Kod SMS (6 cyfr)" size="small" value={ownerOtp}
                    onChange={(e) => setOwnerOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ inputMode: 'numeric', maxLength: 6 }} sx={{ width: 160 }} />
                  <Button variant="contained" disabled={busy || ownerOtp.length !== 6} onClick={verifyOwnerCode}>
                    Podpisz
                  </Button>
                  <Button size="small" onClick={sendOwnerCode} disabled={busy}>Wyślij ponownie</Button>
                </Stack>
              )}
            </Paper>
          )}

          {/* ETAP 2 — powiadomienie klienta */}
          {['owner_signed', 'pending_client'].includes(contract.signing_status) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>ETAP 2 — podpis klienta</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {contract.signing_status === 'pending_client'
                  ? 'Klient został powiadomiony i podpisuje umowę w panelu klienta.'
                  : 'Właściciel podpisał. Powiadom klienta o oczekującym podpisie.'}
              </Typography>
              <Button variant="contained" startIcon={<SmsIcon />} disabled={busy}
                onClick={() => run(() => api.post(`/admin/contracts/${contract.id}/notify-client`), 'Powiadomiono klienta (SMS + e-mail)').catch(() => {})}>
                {contract.signing_status === 'pending_client' ? 'Wyślij przypomnienie' : 'Powiadom klienta'}
              </Button>
            </Paper>
          )}

          {/* Finał */}
          {contract.signing_status === 'fully_signed' && (
            <Alert severity="success">
              <Stack spacing={1} alignItems="flex-start">
                <span>Umowa podpisana przez obie strony. Końcowy PDF zawiera stronę potwierdzenia.</span>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {contract.signed_pdf_url && (
                    <Button size="small" variant="outlined" onClick={() => downloadSigned(contract.signed_pdf_url)}>
                      Pobierz podpisaną umowę
                    </Button>
                  )}
                  {contract.drive_signed_url && (
                    <Button size="small" component={Link} href={contract.drive_signed_url} target="_blank" rel="noreferrer">
                      Otwórz na Google Drive
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Alert>
          )}

          {/* Regeneracja */}
          {contract.signing_status !== 'fully_signed' && (
            <Box>
              <Button size="small" color="warning"
                onClick={() => {
                  if (window.confirm('Wycofać obecną umowę i wygenerować nową standardową (nowy numer)?')) {
                    run(() => api.post(`/admin/bookings/${bookingId}/contract/standard`), 'Wygenerowano nową umowę').catch(() => {});
                    setOtpStage(false);
                  }
                }}>
                Wygeneruj umowę od nowa
              </Button>
            </Box>
          )}

          <Divider />
          <ContractTimeline events={data.events} signatures={data.signatures} />
        </Stack>
      )}

      <ContractPreviewDialog
        open={preview}
        previewUrl={contract?.preview_url}
        onClose={() => setPreview(false)}
        onConfirm={confirmRead}
        confirming={busy}
      />
    </Paper>
  );
}

/** Pobranie podpisanego PDF przez autoryzowany endpoint (blob → zapis). */
async function downloadSigned(url) {
  const res = await api.get(url, { responseType: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(res.data);
  link.download = 'umowa-podpisana.pdf';
  link.click();
  URL.revokeObjectURL(link.href);
}
