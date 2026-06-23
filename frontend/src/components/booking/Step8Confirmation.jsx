import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import CelebrationIcon from '@mui/icons-material/Celebration';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import { useBookingWizard } from '../../store/bookingWizardStore';
import { formatPrice } from '../../utils/format';

/** KROK 8 — potwierdzenie + umowa. */
export default function Step8Confirmation() {
  const { result, reset } = useBookingWizard();

  if (!result) return null;
  const isIndividual = result.requires_individual_quote;
  const isInquiry = result.requires_manual_confirmation && !isIndividual;

  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      {isInquiry || isIndividual ? (
        <HourglassTopIcon sx={{ fontSize: 64, color: 'warning.main' }} />
      ) : (
        <CelebrationIcon sx={{ fontSize: 64, color: 'primary.main' }} />
      )}
      <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
        {isInquiry || isIndividual ? 'Zapytanie przyjęte!' : 'Rezerwacja przyjęta!'}
      </Typography>

      {isIndividual ? (
        <Alert severity="warning" sx={{ textAlign: 'left', my: 3 }}>
          Twoja impreza podlega <strong>wycenie indywidualnej</strong>. W ciągu <strong>24 godzin</strong>{' '}
          przygotujemy i wyślemy Ci spersonalizowaną ofertę z wariantami do wyboru. W razie pytań:{' '}
          <strong>kontakt@mmevents.pl</strong>.
        </Alert>
      ) : isInquiry ? (
        <Alert severity="warning" sx={{ textAlign: 'left', my: 3 }}>
          W wybranym dniu mamy już zaplanowaną realizację, dlatego Twoje zgłoszenie trafiło do nas jako{' '}
          <strong>zapytanie</strong>. Przeanalizujemy logistykę (czas dojazdu, montaż i demontaż) i potwierdzimy
          rezerwację ręcznie — zwykle w ciągu 24 h. Informację wyślemy e-mailem.
        </Alert>
      ) : (
        <Alert severity="success" sx={{ textAlign: 'left', my: 3 }}>
          <Stack spacing={0.5}>
            <span>
              Rezerwacja <strong>#{result.booking_id}</strong> została utworzona.
            </span>
            {result.contract?.number && (
              <span>
                Umowa nr <strong>{result.contract.number}</strong> jest przygotowywana — link do podpisu elektronicznego
                wyślemy e-mailem.
              </span>
            )}
            <span>
              Do potwierdzenia rezerwacji wymagany jest zadatek: <strong>{formatPrice(result.deposit_amount)}</strong>{' '}
              (dane do przelewu otrzymasz po podpisaniu umowy).
            </span>
            <span>
              Ta impreza <strong>nie podlega wycenie indywidualnej</strong> (wesela i urodziny do 200 osób dla
              klientów indywidualnych).
            </span>
          </Stack>
        </Alert>
      )}
      {isInquiry && (
        <Alert severity="info" sx={{ textAlign: 'left', mb: 3 }}>
          Ta impreza <strong>podlega indywidualnemu potwierdzeniu</strong> — skontaktujemy się z Tobą w celu
          ustalenia szczegółów.
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Po potwierdzeniu rezerwacji w panelu klienta wybierzesz animację, tło i szablon wydruku oraz tekst na wydruku.
      </Typography>

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button component={RouterLink} to="/konto" variant="contained" size="large" onClick={reset}>
          Przejdź do panelu klienta
        </Button>
        <Button onClick={reset} size="large">
          Nowa rezerwacja
        </Button>
      </Stack>
    </Box>
  );
}
