import { Paper, Stepper, Step, StepLabel, Box, Typography, useMediaQuery } from '@mui/material';
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
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Stepper activeStep={step} alternativeLabel={!compact} sx={{ mb: 4 }} orientation="horizontal">
          {STEPS.map((label, i) => (
            <Step key={label}>
              <StepLabel>{compact ? (i === step ? label : '') : label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <StepComponent />
      </Paper>
    </Box>
  );
}
