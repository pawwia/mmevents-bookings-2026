import { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/pl';

import { buildTheme } from './theme/theme';
import { useSettingsStore } from './store/settingsStore';
import { useAuthStore } from './store/authStore';

import PublicLayout from './components/common/PublicLayout';
import ClientLayout from './components/common/ClientLayout';
import AdminLayout from './components/admin/AdminLayout';

import BookingWizardPage from './pages/public/BookingWizardPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import OfferPage from './pages/public/OfferPage';

import MyBookingsPage from './pages/client/MyBookingsPage';
import ClientBookingDetailPage from './pages/client/BookingDetailPage';
import ProfilePage from './pages/client/ProfilePage';
import VerifyEmailPage from './pages/public/VerifyEmailPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';
import PrivacyPolicyPage from './pages/public/PrivacyPolicyPage';
import TermsPage from './pages/public/TermsPage';
import Analytics from './components/common/Analytics';
import ConsentBanner from './components/common/ConsentBanner';

import DashboardPage from './pages/admin/DashboardPage';
import CalendarPage from './pages/admin/CalendarPage';
import BookingsPage from './pages/admin/BookingsPage';
import AdminBookingDetailPage from './pages/admin/BookingDetailPage';
import PackagesPage from './pages/admin/PackagesPage';
import CatalogPage from './pages/admin/CatalogPage';
import DiscountsPage from './pages/admin/DiscountsPage';
import OffersPage from './pages/admin/OffersPage';
import MessageTemplatesPage from './pages/admin/MessageTemplatesPage';
import ClientsPage from './pages/admin/ClientsPage';
import SettingsPage from './pages/admin/SettingsPage';
import AuditPage from './pages/admin/AuditPage';
import LogsPage from './pages/admin/LogsPage';
import AvailabilityChecksPage from './pages/admin/AvailabilityChecksPage';
import BlackoutsPage from './pages/admin/BlackoutsPage';
import StatsPage from './pages/admin/StatsPage';

function RequireAuth({ children, admin = false }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/logowanie" replace />;
  if (admin && user?.role !== 'admin') return <Navigate to="/konto" replace />;
  return children;
}

export default function App() {
  const { settings, loaded, load } = useSettingsStore();
  useEffect(() => {
    load();
  }, [load]);

  // Favicon i tytuł z ustawień (z cache-bustingiem, by podmieniony plik od razu się odświeżył)
  useEffect(() => {
    const favicon = settings['appearance.favicon_url'];
    if (favicon) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = `${favicon}${favicon.includes('?') ? '&' : '?'}v=${Date.now()}`;
    }
    if (settings['company.name']) {
      document.title = `${settings['company.name']} — Rezerwacja fotolustra`;
    }
  }, [settings]);

  const theme = useMemo(() => buildTheme(settings), [settings]);

  if (!loaded) return null;

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pl">
        <CssBaseline />
        <Analytics />
        <ConsentBanner />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<BookingWizardPage />} />
            <Route path="/rezerwacja" element={<BookingWizardPage />} />
            <Route path="/logowanie" element={<LoginPage />} />
            <Route path="/rejestracja" element={<RegisterPage />} />
            <Route path="/oferta/:token" element={<OfferPage />} />
            <Route path="/weryfikacja/:token" element={<VerifyEmailPage />} />
            <Route path="/przypomnij-haslo" element={<ForgotPasswordPage />} />
            <Route path="/reset-hasla/:token" element={<ResetPasswordPage />} />
            <Route path="/polityka-prywatnosci" element={<PrivacyPolicyPage />} />
            <Route path="/regulamin" element={<TermsPage />} />
          </Route>

          <Route
            path="/konto"
            element={
              <RequireAuth>
                <ClientLayout />
              </RequireAuth>
            }
          >
            <Route index element={<MyBookingsPage />} />
            <Route path="rezerwacje/:id" element={<ClientBookingDetailPage />} />
            <Route path="profil" element={<ProfilePage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <RequireAuth admin>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="kalendarz" element={<CalendarPage />} />
            <Route path="rezerwacje" element={<BookingsPage />} />
            <Route path="rezerwacje/:id" element={<AdminBookingDetailPage />} />
            <Route path="urlopy" element={<BlackoutsPage />} />
            <Route path="statystyki" element={<StatsPage />} />
            <Route path="pakiety" element={<PackagesPage />} />
            <Route path="animacje" element={<CatalogPage type="animations" title="Animacje" />} />
            <Route path="tla" element={<CatalogPage type="backgrounds" title="Tła" />} />
            <Route path="szablony-wydrukow" element={<CatalogPage type="print-templates" title="Szablony wydruków" />} />
            <Route path="ksiegi-gosci" element={<CatalogPage type="guestbook-designs" title="Księgi gości (wzory)" />} />
            <Route path="kody-rabatowe" element={<DiscountsPage />} />
            <Route path="oferty" element={<OffersPage />} />
            <Route path="tresci" element={<MessageTemplatesPage />} />
            <Route path="klienci" element={<ClientsPage />} />
            <Route path="ustawienia" element={<SettingsPage />} />
            <Route path="audyt" element={<AuditPage />} />
            <Route path="logi" element={<LogsPage />} />
            <Route path="sprawdzenia-terminow" element={<AvailabilityChecksPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
