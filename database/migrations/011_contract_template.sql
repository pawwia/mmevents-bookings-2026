-- 011 — lokalny szablon umowy (HTML) renderowany do PDF na serwerze (Dompdf).
-- Zastępuje zależność od Google Docs przy generowaniu umowy. Edytowalny w CRM →
-- Ustawienia → Podpis umów. Obsługuje znaczniki {{...}} podstawiane z rezerwacji.
SET NAMES utf8mb4;

INSERT IGNORE INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('signing', 'contract.template_html',
'<style>
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 12px; margin: 16px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  .meta { text-align: center; color: #666; font-size: 10px; margin-bottom: 16px; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { padding: 2px 4px; vertical-align: top; }
  table.kv td.l { width: 38%; color: #555; }
  .sign { margin-top: 40px; }
  .sign td { width: 50%; text-align: center; padding-top: 28px; border-top: 1px solid #333; font-size: 10px; }
</style>
<h1>Umowa nr {{numer_umowy}}</h1>
<div class="meta">zawarta w {{miejscowosc}} dnia {{data_zawarcia}}</div>

<p>pomiędzy <strong>{{nazwa_firmy_wykonawcy}}</strong>, {{adres_wykonawcy}}, NIP {{nip_wykonawcy}} (Wykonawca),<br>
a {{imie}} {{nazwisko}}{{nazwa_firmy_blok}}, {{adres_klienta}} (Zamawiający).</p>

<h2>§1. Przedmiot umowy</h2>
<p>Wykonawca zobowiązuje się do świadczenia usługi wynajmu fotolustra w ramach pakietu
<strong>{{pakiet}}</strong> podczas imprezy Zamawiającego.</p>
<table class="kv">
  <tr><td class="l">Data imprezy</td><td>{{data_imprezy}}, godzina rozpoczęcia {{godzina_startu}}</td></tr>
  <tr><td class="l">Czas trwania</td><td>{{czas_trwania}}</td></tr>
  <tr><td class="l">Lokalizacja</td><td>{{lokalizacja}}</td></tr>
  <tr><td class="l">Księga gości</td><td>{{ksiega_gosci}}</td></tr>
</table>

<h2>§2. Wynagrodzenie</h2>
<table class="kv">
  <tr><td class="l">Cena całkowita</td><td><strong>{{kwota}}</strong></td></tr>
  <tr><td class="l">Zadatek (płatny po podpisaniu umowy)</td><td>{{zadatek}}</td></tr>
  <tr><td class="l">Numer konta do wpłaty</td><td>{{numer_konta}}</td></tr>
</table>

<h2>§3. Postanowienia końcowe</h2>
<p>Zadatek wpłacany jest na poczet realizacji usługi. W sprawach nieuregulowanych niniejszą umową
zastosowanie mają przepisy Kodeksu cywilnego. Umowę sporządzono w formie elektronicznej, a podpisy
złożono dwuetapowo z weryfikacją kodami SMS, co potwierdza dołączona strona potwierdzenia podpisu.</p>

<table class="sign"><tr>
  <td>{{nazwa_firmy_wykonawcy}}<br>(Wykonawca)</td>
  <td>{{imie}} {{nazwisko}}<br>(Zamawiający)</td>
</tr></table>',
'text', 'Szablon umowy (HTML)', 0, 20),
('signing', 'contract.place', 'Szczecin', 'string', 'Miejscowość zawarcia umowy', 0, 21);
