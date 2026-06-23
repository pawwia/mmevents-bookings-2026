import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

/** Ładuje skrypt Cloudflare Turnstile raz na całą aplikację. */
let loaderPromise;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Nie udało się załadować Cloudflare Turnstile'));
      document.head.appendChild(s);
    });
  }
  return loaderPromise;
}

/**
 * Widget Cloudflare Turnstile (CAPTCHA). Renderuje się tylko, gdy w ustawieniach jest Site Key.
 * Props:
 *  - onToken(token): wywoływane z tokenem (lub '' przy wygaśnięciu/błędzie),
 *  - refreshKey: zmiana wartości wymusza świeży token (token jest jednorazowy).
 */
export default function Turnstile({ onToken, refreshKey = 0, action }) {
  const siteKey = useSettingsStore((s) => s.settings['security.turnstile_site_key']);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!siteKey || !boxRef.current) return undefined;
    let cancelled = false;
    let widgetId;
    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile || !boxRef.current) return;
        boxRef.current.innerHTML = '';
        widgetId = window.turnstile.render(boxRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      })
      .catch(() => onToken(''));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* widget już usunięty */
        }
      }
    };
  }, [siteKey, refreshKey, action, onToken]);

  if (!siteKey) return null;
  return <div ref={boxRef} style={{ marginTop: 8 }} />;
}
