import { Box, Divider, Link, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';
import { useSettingsStore } from '../../store/settingsStore';

const UPDATED = '21.06.2026';

function H({ children }) {
  return (
    <Typography variant="h6" sx={{ mt: 3, mb: 1, fontWeight: 700 }}>
      {children}
    </Typography>
  );
}
function P({ children }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2, lineHeight: 1.7 }}>
      {children}
    </Typography>
  );
}
function Li({ primary, secondary }) {
  return (
    <ListItem sx={{ py: 0.3, alignItems: 'flex-start' }}>
      <ListItemText
        primary={primary}
        secondary={secondary}
        primaryTypographyProps={{ variant: 'body2' }}
        secondaryTypographyProps={{ variant: 'body2' }}
      />
    </ListItem>
  );
}

/** Polityka prywatności (RODO) — /polityka-prywatnosci */
export default function PrivacyPolicyPage() {
  const settings = useSettingsStore((s) => s.settings);
  const email = settings['company.email'] || 'kontakt@mmevents.pl';
  const phone = settings['company.phone'];

  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Polityka prywatności
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Ostatnia aktualizacja: {UPDATED}
      </Typography>
      <Divider sx={{ my: 2 }} />

      <P>
        Niniejsza polityka prywatności wyjaśnia, w jaki sposób przetwarzamy dane osobowe osób
        odwiedzających naszą stronę oraz korzystających z formularzy kontaktowych. Zależy nam, aby
        zasady te były jasne i zrozumiałe.
      </P>

      <H>1. Administrator danych</H>
      <P>Administratorem Twoich danych osobowych jest:</P>
      <P>
        <strong>Downwind Paweł Wiatrak</strong>
        <br />
        ul. Pozdawilska 4A, 71-772 Szczecin
        <br />
        NIP: 8513226914
        <br />
        E-mail: <Link href={`mailto:${email}`}>{email}</Link>
        {phone ? (
          <>
            <br />
            Telefon: {phone}
          </>
        ) : null}
      </P>

      <H>2. Jakie dane zbieramy</H>
      <List dense disablePadding>
        <Li primary="Dane podane w formularzach: imię, nazwisko, numer telefonu, adres e-mail oraz treść wiadomości." />
        <Li primary="Dane techniczne zbierane automatycznie: adres IP, typ urządzenia i przeglądarki, informacje z plików cookies oraz dane o sposobie korzystania ze strony." />
      </List>

      <H>3. Cele i podstawy prawne przetwarzania</H>
      <List dense disablePadding>
        <Li primary="Kontakt i odpowiedź na zapytanie wysłane przez formularz" secondary="art. 6 ust. 1 lit. b oraz lit. f RODO — podjęcie działań na żądanie osoby oraz nasz prawnie uzasadniony interes (obsługa zapytań)." />
        <Li primary="Przygotowanie oferty i realizacja usług / umowy" secondary="art. 6 ust. 1 lit. b RODO — wykonanie umowy lub działania przed jej zawarciem." />
        <Li primary="Analityka, statystyka i marketing (w tym pliki cookies analityczne i marketingowe)" secondary="art. 6 ust. 1 lit. a RODO — Twoja dobrowolna zgoda wyrażona poprzez baner cookies." />
        <Li primary="Wypełnienie obowiązków prawnych (np. podatkowych, rachunkowych)" secondary="art. 6 ust. 1 lit. c RODO." />
        <Li primary="Ustalenie, dochodzenie lub obrona roszczeń" secondary="art. 6 ust. 1 lit. f RODO — nasz prawnie uzasadniony interes." />
      </List>

      <H>4. Pliki cookies</H>
      <P>
        Strona korzysta z plików cookies (oraz podobnych technologii). Dzielimy je na: niezbędne
        (konieczne do działania strony), analityczne (pomagają zrozumieć, jak korzystasz ze strony)
        oraz marketingowe (umożliwiają dopasowanie przekazu reklamowego).
      </P>
      <P>
        Cookies analityczne i marketingowe uruchamiamy wyłącznie po wyrażeniu przez Ciebie zgody w
        banerze cookies. Zgodę możesz w każdej chwili wycofać lub zmienić ustawienia plików cookies w
        swojej przeglądarce. Ograniczenie cookies może wpłynąć na działanie niektórych funkcji strony.
      </P>

      <H>5. Narzędzia analityczne i reklamowe</H>
      <P>
        Za Twoją zgodą korzystamy z narzędzi analitycznych i marketingowych dostarczanych przez
        podmioty zewnętrzne, m.in. Google (Google Analytics, Google Tag Manager), Meta (Facebook,
        Instagram) oraz TikTok. Narzędzia te mogą wykorzystywać pliki cookies i identyfikatory
        urządzeń, a także tworzyć statystyki oraz dopasowywać reklamy (profilowanie marketingowe).
        Profilowanie to nie wywołuje wobec Ciebie skutków prawnych.
      </P>

      <H>6. Odbiorcy danych i partnerzy</H>
      <P>
        Dane mogą być powierzane lub udostępniane zaufanym partnerom, którzy wspierają nas
        technologicznie i marketingowo, w szczególności:
      </P>
      <List dense disablePadding>
        <Li primary="Google (analityka, tagi, reklama)" />
        <Li primary="Meta — Facebook, Instagram (reklama, piksel)" />
        <Li primary="TikTok (reklama, analityka)" />
        <Li primary="dostawcy hostingu i infrastruktury serwerowej" />
        <Li primary="dostawcy poczty e-mail oraz systemów wysyłki wiadomości i SMS" />
        <Li primary="dostawcy narzędzi marketingowych i analitycznych" />
      </List>
      <P>
        Niektórzy partnerzy (np. Google, Meta, TikTok) mogą przetwarzać dane poza Europejskim
        Obszarem Gospodarczym. W takich przypadkach przekazanie odbywa się na podstawie odpowiednich
        zabezpieczeń, w szczególności standardowych klauzul umownych zatwierdzonych przez Komisję
        Europejską.
      </P>

      <H>7. Twoje prawa (RODO)</H>
      <List dense disablePadding>
        <Li primary="prawo dostępu do danych oraz uzyskania ich kopii," />
        <Li primary="prawo do sprostowania (poprawienia) danych," />
        <Li primary="prawo do usunięcia danych (tzw. prawo do bycia zapomnianym)," />
        <Li primary="prawo do ograniczenia przetwarzania," />
        <Li primary="prawo do przenoszenia danych," />
        <Li primary="prawo do sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie," />
        <Li primary="prawo do cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania sprzed cofnięcia)," />
        <Li primary="prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (PUODO), ul. Stawki 2, 00-193 Warszawa." />
      </List>
      <P>
        Aby skorzystać z powyższych praw, skontaktuj się z nami pod adresem{' '}
        <Link href={`mailto:${email}`}>{email}</Link>.
      </P>

      <H>8. Okres przechowywania danych</H>
      <List dense disablePadding>
        <Li primary="Dane z formularzy kontaktowych — przez czas niezbędny do obsługi zapytania, a następnie do upływu okresu przedawnienia ewentualnych roszczeń." />
        <Li primary="Dane związane z umową/usługą — przez czas jej realizacji oraz przez okres wymagany przepisami (np. podatkowymi i rachunkowymi)." />
        <Li primary="Dane przetwarzane na podstawie zgody (analityka, marketing) — do czasu cofnięcia zgody." />
      </List>

      <H>9. Dobrowolność podania danych</H>
      <P>
        Podanie danych jest dobrowolne, jednak niezbędne do skorzystania z formularza kontaktowego i
        uzyskania odpowiedzi lub oferty. Brak podania danych może uniemożliwić obsługę zapytania.
      </P>

      <H>10. Kontakt</H>
      <P>
        W sprawach dotyczących ochrony danych osobowych możesz kontaktować się z administratorem:{' '}
        <Link href={`mailto:${email}`}>{email}</Link>
        {phone ? `, tel. ${phone}` : ''}.
      </P>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ textAlign: 'center' }}>
        <Link href="/regulamin">Zobacz również: Regulamin</Link>
      </Box>
    </Paper>
  );
}
