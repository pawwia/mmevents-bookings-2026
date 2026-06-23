import { useState } from 'react';
import {
  Box, Card, CardActionArea, CardContent, CardMedia, Grid, Typography, Chip, Button,
} from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { useBookingWizard } from '../../store/bookingWizardStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatPrice } from '../../utils/format';
import { ImagePreviewDialog } from '../common/MediaDialogs';
import WizardNav from './WizardNav';

/**
 * KROK 6 — księga gości.
 * Pakiety 1–3H: standardowa 100 zł / personalizowana 150 zł.
 * Pakiety 4–5H: standardowa gratis / personalizowana 75 zł (ceny z cennika pakietu).
 * Zdjęcia ksiąg podmienialne w CRM → Ustawienia → Rezerwacje.
 */
export default function Step6Guestbook() {
  const { guestbook, pkg, set } = useBookingWizard();
  const settings = useSettingsStore((s) => s.settings);
  const [preview, setPreview] = useState(null);

  const standardPrice = Number(pkg?.guestbook_standard_price ?? 100);
  const personalizedPrice = Number(pkg?.guestbook_personalized_price ?? 150);
  const INCLUDED_NOTE = 'W cenie: naklejki, pisaki, kleje i inne akcesoria do wklejania zdjęć.';

  const OPTIONS = [
    {
      value: 'none',
      title: 'Bez księgi gości',
      price: 0,
      image: null,
      description: 'Możesz dokupić ją później, kontaktując się z nami.',
    },
    {
      value: 'standard',
      title: 'Księga standardowa',
      price: standardPrice,
      image: settings['booking.guestbook_standard_image'] || '/images/placeholder-background.png',
      description: `Elegancka księga, w której goście wklejają zdjęcia i piszą życzenia. ${INCLUDED_NOTE}`,
    },
    {
      value: 'personalized',
      title: 'Księga personalizowana',
      price: personalizedPrice,
      image: settings['booking.guestbook_personalized_image'] || '/images/placeholder-background.png',
      description: `Księga z personalizowaną okładką — imiona, data, motyw przewodni imprezy. ${INCLUDED_NOTE}`,
    },
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Księga gości
      </Typography>
      <Grid container spacing={2}>
        {OPTIONS.map((option) => (
          <Grid item xs={12} sm={4} key={option.value}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                borderColor: guestbook === option.value ? 'primary.main' : 'divider',
                borderWidth: guestbook === option.value ? 2 : 1,
                bgcolor: guestbook === option.value ? 'pink.light' : '#fff',
              }}
            >
              <CardActionArea onClick={() => set({ guestbook: option.value })} sx={{ height: '100%' }}>
                {option.image && (
                  <CardMedia component="img" height="140" image={option.image} alt={option.title} sx={{ objectFit: 'cover', bgcolor: '#EEE' }} />
                )}
                <CardContent>
                  {!option.image && <AutoStoriesIcon color="disabled" />}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: option.image ? 0 : 1 }}>
                    {option.title}
                  </Typography>
                  <Chip
                    size="small"
                    color={option.price === 0 ? 'success' : 'default'}
                    label={option.price === 0 ? (option.value === 'none' ? '—' : 'GRATIS w Twoim pakiecie') : formatPrice(option.price)}
                    sx={{ my: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {option.description}
                  </Typography>
                  {option.image && (
                    <Button
                      size="small"
                      startIcon={<ZoomInIcon />}
                      sx={{ mt: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreview(option);
                      }}
                    >
                      Powiększ zdjęcie
                    </Button>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      <ImagePreviewDialog open={!!preview} src={preview?.image} title={preview?.title} onClose={() => setPreview(null)} />
      <WizardNav />
    </Box>
  );
}
