import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { api, apiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

/**
 * Przycisk "Zaloguj przez Google" — Google Identity Services.
 * Wymaga VITE_GOOGLE_CLIENT_ID (docs/04-google-login.md).
 */
export default function GoogleLoginButton({ onSuccess, onError }) {
  const ref = useRef(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !ref.current) return;

    const init = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            const { data } = await api.post('/auth/google', { credential });
            setAuth(data);
            onSuccess?.(data);
          } catch (e) {
            onError?.(apiError(e));
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
        locale: 'pl',
      });
    };

    if (window.google?.accounts) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = init;
      document.body.appendChild(script);
    }
  }, [clientId, setAuth, onSuccess, onError]);

  if (!clientId) return null;
  return <Box ref={ref} sx={{ display: 'flex', justifyContent: 'center', my: 1 }} />;
}
