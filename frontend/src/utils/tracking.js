/**
 * Analityka/piksele: Google Tag Manager, Google Analytics 4 (gtag) i Facebook Pixel.
 * ID pobierane z publicznych ustawień (CRM → Ustawienia → Analityka). Skrypty ładują się raz.
 * Page view i zdarzenia (sprawdzenie terminu, rezerwacja) wysyłane do wszystkich aktywnych narzędzi.
 */
let initialized = false;

const CONSENT_KEY = 'mmevents-cookie-consent';

/** 'granted' | 'denied' | null (brak decyzji). */
export function consentStatus() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function hasConsent() {
  return consentStatus() === 'granted';
}

export function setConsent(granted) {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    /* brak localStorage — pomijamy */
  }
}

export function initTracking(settings) {
  if (initialized || typeof window === 'undefined') return;
  const gtm = settings['analytics.gtm_id'];
  const ga = settings['analytics.ga_measurement_id'];
  const fb = settings['analytics.fb_pixel_id'];
  if (!gtm && !ga && !fb) return;
  initialized = true;
  window.dataLayer = window.dataLayer || [];

  if (gtm) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`;
    document.head.appendChild(s);
    const ns = document.createElement('noscript');
    ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtm)}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(ns, document.body.firstChild);
  }

  if (ga) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`;
    document.head.appendChild(s);
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // Page view wysyłamy samodzielnie przy każdej zmianie trasy (SPA) — wyłączamy automatyczny.
    window.gtag('config', ga, { send_page_view: false });
  }

  if (fb) {
    loadFbPixel(fb);
  }
}

function loadFbPixel(id) {
  if (window.fbq) return;
  const n = (window.fbq = function fbq() {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  });
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  const t = document.createElement('script');
  t.async = true;
  t.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(t);
  window.fbq('init', id);
  // Pierwszy PageView wyśle trackPageView (mount) — unikamy podwójnego liczenia.
}

export function trackPageView(path) {
  if (typeof window === 'undefined') return;
  if (window.fbq) window.fbq('track', 'PageView');
  if (window.gtag) window.gtag('event', 'page_view', { page_path: path });
  if (window.dataLayer) window.dataLayer.push({ event: 'page_view', page_path: path });
}

/** Zdarzenie niestandardowe wysyłane do wszystkich aktywnych narzędzi. */
export function trackEvent(name, params = {}) {
  if (typeof window === 'undefined') return;
  if (window.fbq) window.fbq('trackCustom', name, params);
  if (window.gtag) window.gtag('event', name, params);
  if (window.dataLayer) window.dataLayer.push({ event: name, ...params });
}

/** Zdarzenie liczone tylko raz na sesję (np. sprawdzenie terminu — nawet przy 10 sprawdzeniach). */
export function trackEventOnce(name, params = {}) {
  try {
    const k = `mmevents-evt-${name}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
  } catch {
    /* brak sessionStorage — wyślij mimo to */
  }
  trackEvent(name, params);
}

/** Zakup (standardowe: FB Purchase, GA4 purchase) — np. po złożeniu rezerwacji. */
export function trackPurchase({ value, currency = 'PLN', id, ...rest }) {
  if (typeof window === 'undefined') return;
  if (window.fbq) window.fbq('track', 'Purchase', { value, currency, ...rest });
  if (window.gtag) window.gtag('event', 'purchase', { value, currency, transaction_id: id, ...rest });
  if (window.dataLayer) window.dataLayer.push({ event: 'purchase', value, currency, transaction_id: id, ...rest });
}
