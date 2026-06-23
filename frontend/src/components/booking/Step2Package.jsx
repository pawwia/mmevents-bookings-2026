import { useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardActionArea, CardContent, Chip, Grid, List, ListItem,
  ListItemIcon, ListItemText, Typography, CircularProgress,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/HighlightOff';
import { api, apiError } from '../../api/client';
import { useBookingWizard } from '../../store/bookingWizardStore';
import { formatPrice } from '../../utils/format';
import WizardNav from './WizardNav';

/** KROK 2 — wybór pakietu (cennik dla roku imprezy). */
export default function Step2Package() {
  const { eventDate, packageId, set } = useBookingWizard();
  const [packages, setPackages] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/packages', { params: { date: eventDate } })
      .then(({ data }) => setPackages(data))
      .catch((e) => setError(apiError(e)));
  }, [eventDate]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!packages)
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Wybierz pakiet
      </Typography>
      <Grid container spacing={2}>
        {packages.map((pkg) => (
          <Grid item xs={12} sm={6} md={4} key={pkg.id}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                borderColor: packageId === pkg.id ? 'primary.main' : 'divider',
                borderWidth: packageId === pkg.id ? 2 : 1,
                bgcolor: packageId === pkg.id ? 'pink.light' : '#fff',
              }}
            >
              <CardActionArea onClick={() => set({ packageId: pkg.id, pkg })} sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6">{pkg.name}</Typography>
                  <Typography variant="h5" color="primary.dark" sx={{ fontWeight: 800, my: 1 }}>
                    {formatPrice(pkg.price)}
                  </Typography>
                  <Chip size="small" label={pkg.free_km > 0 ? `Transport gratis do ${pkg.free_km} km` : 'Transport płatny 1,60 zł/km'} sx={{ mb: 1 }} />
                  <List dense disablePadding>
                    {(pkg.features?.included || []).map((feature) => (
                      <ListItem key={feature} disableGutters sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckIcon fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary={feature} primaryTypographyProps={{ fontSize: 13 }} />
                      </ListItem>
                    ))}
                    {(pkg.features?.excluded || []).map((feature) => (
                      <ListItem key={feature} disableGutters sx={{ py: 0, opacity: 0.55 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CloseIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={feature} primaryTypographyProps={{ fontSize: 13 }} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      <WizardNav nextDisabled={!packageId} />
    </Box>
  );
}
