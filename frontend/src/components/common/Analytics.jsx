import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { initTracking, trackPageView, hasConsent } from '../../utils/tracking';

/**
 * Inicjuje GTM/GA4/FB Pixel z ustawień i wysyła page view przy zmianie trasy —
 * wyłącznie po wyrażeniu zgody na cookies (RODO). Bez zgody nic się nie ładuje.
 */
export default function Analytics() {
  const settings = useSettingsStore((s) => s.settings);
  const location = useLocation();

  useEffect(() => {
    if (hasConsent()) initTracking(settings);
  }, [settings]);

  useEffect(() => {
    if (hasConsent()) trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
