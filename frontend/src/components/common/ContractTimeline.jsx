import { Box, Typography, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { formatDateTime } from '../../utils/format';

const ICON_COLOR = {
  owner_signed: 'success.main',
  client_signed: 'success.main',
  drive_saved: 'success.main',
  drive_error: 'error.main',
  hash_generated: 'info.main',
};

/** Timeline procesu podpisywania (zdarzenia + dowody podpisu). */
export default function ContractTimeline({ events = [], signatures = [] }) {
  const sigByParty = {};
  signatures.forEach((s) => (sigByParty[s.party] = s));

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Historia podpisu
      </Typography>
      {events.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Brak zdarzeń.
        </Typography>
      )}
      <Stack spacing={0.75}>
        {events.map((ev, i) => (
          <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
            <CheckCircleIcon sx={{ fontSize: 16, mt: '2px', color: ICON_COLOR[ev.type] || 'text.disabled' }} />
            <Box>
              <Typography variant="body2">{ev.message}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(ev.created_at)}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>

      {signatures.length > 0 && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Dowody podpisu (IP, telefon, identyfikator OTP)
          </Typography>
          {['owner', 'client'].map((party) =>
            sigByParty[party] ? (
              <Typography key={party} variant="caption" display="block">
                <strong>{party === 'owner' ? 'Właściciel' : 'Klient'}:</strong>{' '}
                {formatDateTime(sigByParty[party].signed_at)} • IP {sigByParty[party].ip} • tel {sigByParty[party].phone} • OTP{' '}
                {sigByParty[party].otp_identifier}
              </Typography>
            ) : null
          )}
        </Box>
      )}
    </Box>
  );
}
