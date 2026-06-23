import { Paper, Stepper, Step, StepLabel, Box, Typography, LinearProgress, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useBookingWizard } from '../../store/bookingWizardStore';
import Step1Date from '../../components/booking/Step1Date';
import Step2Package from '../../components/booking/Step2Package';
import Step3Time from '../../components/booking/Step3Time';
import Step4Location from '../../components/booking/Step4Location';
import Step5Client from '../../components/booking/Step5Client';
import Step6Guestbook from '../../components/booking/Step6Guestbook';
import Step7Summary from '../../components/booking/Step7Summary';
import Step8Confirmation from '../../components/booking/Step8Confirmation';

const STEPS = ['Termin', 'Pakiet', 'Godzina', 'Lokalizacja', 'Twoje dane', 'Księga gości', 'Podsumowanie', 'Umowa'];
const COMPONENTS = [Step1Date, Step2Package, Step3Time, Step4Location, Step5Client, Step6Guestbook, Step7Summary, Step8Confirmation];

export default function BookingWizardPage() {
  const step = useBookingWizard((s) => s.step);
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const StepComponent = COMPONENTS[step];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Zarezerwuj fotolustro
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Kilka prostych kroków i termin jest Twój. ✨
      </Typography>
      <Paper sx={{ p: { xs: 2, md: 4 }, overflow: 'hidden' }}>
        {compact ? (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
              Krok {step + 1} z {STEPS.length}: <strong>{STEPS[step]}</strong>
            </Typography>
            <LinearProgress variant="determinate" value={((step + 1) / STEPS.length) * 100} sx={{ borderRadius: 1, height: 6 }} />
          </Box>
        ) : (
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        )}
        <StepComponent />
      </Paper>
    </Box>
  );
}
