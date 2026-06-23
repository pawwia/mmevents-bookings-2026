import { Box, Button } from '@mui/material';
import { useBookingWizard } from '../../store/bookingWizardStore';

/** Wspólna nawigacja kroków: Wstecz / Dalej. */
export default function WizardNav({ nextDisabled = false, nextLabel = 'Dalej', onNext, hideBack = false }) {
  const { back, next, step } = useBookingWizard();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
      {!hideBack && step > 0 ? <Button onClick={back}>Wstecz</Button> : <span />}
      <Button variant="contained" size="large" disabled={nextDisabled} onClick={onNext || next}>
        {nextLabel}
      </Button>
    </Box>
  );
}
