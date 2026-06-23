import { Box } from '@mui/material';
import { useSettingsStore } from '../../store/settingsStore';

/** Logo z ustawień (CRM → Wygląd) — sam znak graficzny, bez tekstu. Placeholder PNG do podmiany. */
export default function Logo({ height = 52 }) {
  const settings = useSettingsStore((s) => s.settings);
  const logoUrl = settings['appearance.logo_url'] || '/images/logo-placeholder.png';
  const name = settings['company.name'] || 'MMEvent';
  return <Box component="img" src={logoUrl} alt={name} sx={{ height, maxWidth: 220, objectFit: 'contain' }} />;
}
