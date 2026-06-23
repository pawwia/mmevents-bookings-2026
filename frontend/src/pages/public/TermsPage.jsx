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
function Li({ primary }) {
  return (
    <ListItem sx={{ py: 0.3, alignItems: 'flex-start' }}>
      <ListItemText primary={primary} primaryTypographyProps={{ variant: 'body2' }} />
    </ListItem>
  );
}

/** Regulamin strony — /regulamin */
export default function TermsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const email = settings['company.email'] || 'kontakt@mmevents.pl';
  const phone = settings['company.phone'];

  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Regulamin
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Ostatnia aktualizacja: {UPDATED}
      </Typography>
      <Divider sx={{ my: 2 }} />

      <H>1. Postanowienia ogólne</H>
      <P>
        Niniejszy regulamin określa zasady korzystania ze strony internetowej prowadzonej przez{' '}
        <strong>Downwind Paweł Wiatrak</strong>, ul. Pozdawilska 4A, 71-772 Szczecin, NIP 8513226914
        (dalej: „Właściciel"). Korzystając ze strony, akceptujesz postanowienia regulaminu.
      </P>

      <H>2. Charakter strony</H>
      <P>
        Strona ma charakter informacyjny i służy do prezentacji usług oraz umożliwienia kontaktu z
        Właścicielem. Informacje i ceny zamieszczone na stronie nie stanowią oferty w rozumieniu
        Kodeksu cywilnego, lecz zaproszenie do zawarcia umowy (art. 71 K.c.). Szczegółowe warunki
        ustalane są indywidualnie.
      </P>

      <H>3. Korzystanie z formularzy kontaktowych</H>
      <List dense disablePadding>
        <Li primary="Formularze służą do nawiązania kontaktu, zadania pytania lub uzyskania oferty." />
        <Li primary="Podawane dane (imię, nazwisko, telefon, e-mail, treść wiadomości) powinny być prawdziwe i aktualne." />
        <Li primary="Wysłanie formularza nie jest równoznaczne z zawarciem umowy ani z gwarancją realizacji usługi w wybranym terminie." />
      </List>

      <H>4. Zakaz dostarczania treści bezprawnych</H>
      <P>
        Zabronione jest przekazywanie za pośrednictwem strony i formularzy treści o charakterze
        bezprawnym, obraźliwym, wprowadzającym w błąd, naruszającym dobra osobiste lub prawa osób
        trzecich, a także podejmowanie działań zakłócających działanie strony.
      </P>

      <H>5. Własność intelektualna</H>
      <P>
        Treści zamieszczone na stronie (teksty, zdjęcia, grafiki, logo, układ i kod) stanowią
        własność intelektualną Właściciela lub zostały wykorzystane zgodnie z prawem na podstawie
        odpowiednich licencji. Kopiowanie, rozpowszechnianie lub wykorzystywanie tych treści bez zgody
        Właściciela jest zabronione.
      </P>

      <H>6. Ograniczenie odpowiedzialności</H>
      <List dense disablePadding>
        <Li primary="Właściciel dokłada starań, aby strona działała prawidłowo, jednak nie gwarantuje jej nieprzerwanej i bezbłędnej dostępności." />
        <Li primary="Właściciel nie ponosi odpowiedzialności za przerwy techniczne, błędy, utratę danych ani inne zdarzenia wynikające z przyczyn od niego niezależnych (np. siła wyższa, awarie łączy)." />
        <Li primary="Właściciel nie odpowiada za działanie podmiotów trzecich (np. dostawców hostingu, narzędzi analitycznych i marketingowych, operatorów płatności) ani za treści serwisów zewnętrznych, do których prowadzą odnośniki." />
        <Li primary="Powyższe ograniczenia nie wyłączają ani nie ograniczają praw konsumenta wynikających z bezwzględnie obowiązujących przepisów prawa." />
      </List>

      <H>7. Reklamacje</H>
      <P>
        Reklamacje dotyczące działania strony lub obsługi zapytań można składać na adres{' '}
        <Link href={`mailto:${email}`}>{email}</Link>
        {phone ? ` lub telefonicznie: ${phone}` : ''}. Reklamacja powinna zawierać opis sprawy oraz
        dane kontaktowe. Odpowiedź udzielana jest bez zbędnej zwłoki, nie później niż w terminie 14
        dni od jej otrzymania.
      </P>

      <H>8. Pozasądowe rozwiązywanie sporów</H>
      <P>
        Konsument ma możliwość skorzystania z pozasądowych sposobów rozpatrywania reklamacji i
        dochodzenia roszczeń, m.in. przed powiatowym (miejskim) rzecznikiem konsumentów oraz za
        pośrednictwem unijnej platformy internetowego rozstrzygania sporów (ODR), dostępnej pod
        adresem:{' '}
        <Link href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
          ec.europa.eu/consumers/odr
        </Link>
        . Skorzystanie z tych metod jest dobrowolne.
      </P>

      <H>9. Dane osobowe</H>
      <P>
        Zasady przetwarzania danych osobowych oraz wykorzystywania plików cookies opisane są w{' '}
        <Link href="/polityka-prywatnosci">Polityce prywatności</Link>.
      </P>

      <H>10. Postanowienia końcowe</H>
      <List dense disablePadding>
        <Li primary="W sprawach nieuregulowanych regulaminem zastosowanie mają przepisy prawa polskiego." />
        <Li primary="Właściciel może zmienić regulamin z ważnych przyczyn (np. zmiana przepisów, zakresu usług). Aktualna wersja jest zawsze dostępna na tej stronie." />
        <Li primary="Regulamin obowiązuje od dnia publikacji." />
      </List>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ textAlign: 'center' }}>
        <Link href="/polityka-prywatnosci">Zobacz również: Polityka prywatności</Link>
      </Box>
    </Paper>
  );
}
