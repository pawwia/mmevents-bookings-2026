<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\Database;

/**
 * Umowy: numeracja MME/RRRR/MM/NN (każdy miesiąc zaczyna od 20)
 * + generowanie dokumentu z szablonu Google Drive i zapis PDF w storage.
 */
final class ContractService
{
    public const SEQ_START = 20;

    /** Katalog na pliki umów (poza public/ — dostęp tylko przez autoryzowane endpointy). */
    public static function storageDir(int $contractId): string
    {
        $dir = App::basePath() . '/storage/contracts/' . $contractId;
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException(
                'Brak katalogu na umowy lub brak praw zapisu: ' . $dir
                . ' — nadaj prawa zapisu katalogowi backend/storage.'
            );
        }
        return $dir;
    }

    /** Generuje kolejny numer umowy dla bieżącego miesiąca (transakcyjnie). */
    public static function nextNumber(?int $year = null, ?int $month = null): array
    {
        $year ??= (int) date('Y');
        $month ??= (int) date('n');
        $row = Database::selectOne(
            'SELECT MAX(seq) AS max_seq FROM contracts WHERE year = ? AND month = ?',
            [$year, $month]
        );
        $seq = $row && $row['max_seq'] !== null ? ((int) $row['max_seq']) + 1 : self::SEQ_START;
        return [
            'number' => sprintf('MME/%04d/%02d/%d', $year, $month, $seq),
            'year' => $year,
            'month' => $month,
            'seq' => $seq,
        ];
    }

    /**
     * Tworzy umowę dla rezerwacji: numer + kopia szablonu na Drive z podstawionymi danymi
     * + eksport PDF do storage. Zwraca wiersz contracts.
     *
     * @param bool $throwErrors gdy true (ścieżka podpisu) — błędy Drive/PDF są zgłaszane
     *        z czytelnym komunikatem zamiast cichego pominięcia (wymagamy działającego PDF).
     */
    public static function generate(int $bookingId, ?int $adminId = null, string $type = 'standard', bool $throwErrors = false): array
    {
        $booking = Database::selectOne(
            'SELECT b.*, p.name AS package_name, u.first_name, u.last_name, u.email, u.phone,
                    cp.type AS client_type, cp.street, cp.house_no, cp.apartment_no, cp.postal_code, cp.city, cp.country,
                    cp.company_name, cp.nip, cp.company_address, cp.representative
             FROM bookings b
             JOIN users u ON u.id = b.user_id
             LEFT JOIN client_profiles cp ON cp.user_id = u.id
             JOIN packages p ON p.id = b.package_id
             WHERE b.id = ?',
            [$bookingId]
        );
        if ($booking === null) {
            throw new \RuntimeException('Rezerwacja nie istnieje');
        }
        $existing = Database::selectOne(
            "SELECT * FROM contracts WHERE booking_id = ? AND status != 'cancelled' ORDER BY id DESC LIMIT 1",
            [$bookingId]
        );
        if ($existing !== null) {
            return $existing;
        }

        $numberInfo = self::nextNumber();

        $address = $booking['client_type'] === 'company'
            ? (string) $booking['company_address']
            : trim(sprintf(
                '%s %s%s, %s %s, %s',
                $booking['street'], $booking['house_no'],
                $booking['apartment_no'] ? '/' . $booking['apartment_no'] : '',
                $booking['postal_code'], $booking['city'], $booking['country']
            ));

        $companyBlock = $booking['client_type'] === 'company' && $booking['company_name']
            ? ', reprezentujący ' . $booking['company_name'] . ' (NIP ' . $booking['nip'] . ')'
            : '';

        $vars = [
            'numer_umowy' => $numberInfo['number'],
            'data_zawarcia' => date('d.m.Y'),
            'miejscowosc' => SettingsService::get('contract.place', SettingsService::get('signing.place', 'Szczecin')),
            'imie' => $booking['first_name'],
            'nazwisko' => $booking['last_name'],
            'email' => $booking['email'],
            'telefon' => $booking['phone'],
            'adres_klienta' => $address,
            'nazwa_firmy' => $booking['company_name'] ?? '',
            'nazwa_firmy_blok' => $companyBlock,
            'nip' => $booking['nip'] ?? '',
            'osoba_reprezentujaca' => $booking['representative'] ?? '',
            'data_imprezy' => date('d.m.Y', strtotime($booking['event_date'])),
            'godzina_startu' => substr((string) $booking['start_time'], 0, 5),
            'czas_trwania' => rtrim(rtrim((string) $booking['duration_hours'], '0'), '.') . ' h',
            'pakiet' => $booking['package_name'],
            'lokalizacja' => trim(($booking['venue_name'] ? $booking['venue_name'] . ', ' : '') . $booking['venue_address']),
            'kwota' => number_format((float) $booking['total_price'], 2, ',', ' ') . ' zł',
            'zadatek' => number_format((float) $booking['deposit_amount'], 2, ',', ' ') . ' zł',
            'ksiega_gosci' => match ($booking['guestbook']) {
                'standard' => 'standardowa', 'personalized' => 'personalizowana', default => 'brak',
            },
            'nazwa_firmy_wykonawcy' => SettingsService::get('company.name', 'MMEvent'),
            'adres_wykonawcy' => SettingsService::get('company.address', ''),
            'nip_wykonawcy' => SettingsService::get('company.nip', ''),
            'numer_konta' => SettingsService::get('finance.bank_account', ''),
        ];

        $contractId = Database::insert('contracts', [
            'booking_id' => $bookingId,
            'number' => $numberInfo['number'],
            'type' => $type,
            'year' => $numberInfo['year'],
            'month' => $numberInfo['month'],
            'seq' => $numberInfo['seq'],
            'status' => 'draft',
            'signing_status' => 'draft',
        ]);

        // Wybór źródła umowy (dla typu 'uploaded' PDF dostarcza operator później):
        //  1. jeśli skonfigurowano Google Apps Script — kopia szablonu Google Docs na Dysku właściciela,
        //  2. w przeciwnym razie — render z szablonu HTML lokalnie (Dompdf).
        if ($type !== 'uploaded') {
            try {
                if (trim((string) SettingsService::get('contract.gdocs_webapp_url', '')) !== '') {
                    self::generateViaAppsScript($contractId, $booking, $vars);
                } else {
                    self::renderFromTemplate($contractId, $vars);
                }
            } catch (\Throwable $e) {
                error_log('ContractService render: ' . $e->getMessage());
                if ($throwErrors) {
                    throw new \RuntimeException('Nie udało się wygenerować PDF umowy: ' . $e->getMessage());
                }
            }
        }

        return Database::selectOne('SELECT * FROM contracts WHERE id = ?', [$contractId]);
    }

    /** Renderuje treść umowy z szablonu HTML i zapisuje contract.html + contract.pdf. */
    public static function renderFromTemplate(int $contractId, array $vars): void
    {
        $template = SettingsService::get('contract.template_html');
        if (!$template || trim($template) === '') {
            throw new \RuntimeException('Brak szablonu umowy (Ustawienia → Podpis umów → Szablon umowy).');
        }
        $html = MailerService::render($template, $vars);
        $dir = self::storageDir($contractId);
        file_put_contents("$dir/contract.html", $html);
        file_put_contents("$dir/contract.pdf", PdfService::htmlToPdf($html));
        Database::update('contracts', [
            'html_path' => "$dir/contract.html",
            'pdf_path' => "$dir/contract.pdf",
        ], 'id = ?', [$contractId]);
    }

    /**
     * Mapa znaczników szablonu Google Docs (WIELKIE_LITERY) → wartości z rezerwacji.
     * Nazwa znacznika w szablonie {{X}} musi być identyczna z kluczem X tutaj.
     */
    public static function buildReplacements(array $vars): array
    {
        $dash = static fn($v) => trim((string) $v) === '' ? '—' : (string) $v;
        return [
            'NR_UMOWY' => $dash($vars['numer_umowy']),
            'DATA_UMOWY' => $dash($vars['data_zawarcia']),
            'MIEJSCOWOSC' => $dash($vars['miejscowosc']),
            'IMIE_NAZWISKO' => $dash(trim($vars['imie'] . ' ' . $vars['nazwisko'])),
            'ADRES_KLIENTA' => $dash($vars['adres_klienta']),
            'TELEFON' => $dash($vars['telefon']),
            'EMAIL' => $dash($vars['email']),
            'NIP' => $dash($vars['nip']),
            'NAZWA_FIRMY' => $dash($vars['nazwa_firmy']),
            'OSOBA_REPREZENTUJACA' => $dash($vars['osoba_reprezentujaca']),
            'DATA_IMPREZY' => $dash($vars['data_imprezy']),
            'GODZINA_STARTU' => $dash($vars['godzina_startu']),
            'CZAS_TRWANIA' => $dash($vars['czas_trwania']),
            'PAKIET' => $dash($vars['pakiet']),
            'LOKALIZACJA' => $dash($vars['lokalizacja']),
            'KSIEGA_GOSCI' => $dash($vars['ksiega_gosci']),
            'CENA_BRUTTO' => $dash($vars['kwota']),
            'ZADATEK' => $dash($vars['zadatek']),
            'NUMER_KONTA' => $dash($vars['numer_konta']),
            'WYKONAWCA_NAZWA' => $dash($vars['nazwa_firmy_wykonawcy']),
            'WYKONAWCA_ADRES' => $dash($vars['adres_wykonawcy']),
            'WYKONAWCA_NIP' => $dash($vars['nip_wykonawcy']),
        ];
    }

    /**
     * Generuje umowę przez Google Apps Script: POST {secret, name, replacements} na web-app,
     * który kopiuje szablon Google Docs, podstawia znaczniki i zwraca url, doc_id oraz PDF (base64).
     * Zapisuje contract.pdf oraz link do dokumentu (drive_url) do ewentualnej ręcznej edycji.
     */
    public static function generateViaAppsScript(int $contractId, array $booking, array $vars): void
    {
        $url = trim((string) SettingsService::get('contract.gdocs_webapp_url', ''));
        $secret = (string) SettingsService::get('contract.gdocs_secret', '');
        if ($url === '') {
            throw new \RuntimeException('Brak adresu web-app Apps Script (Ustawienia → Podpis umów).');
        }
        $name = 'Umowa ' . str_replace('/', '-', (string) $vars['numer_umowy'])
            . ' ' . trim($booking['first_name'] . ' ' . $booking['last_name']);

        // Wysyłamy znaczniki w obu konwencjach, by pasowały niezależnie od nazw w szablonie:
        //  - WIELKIE_LITERY (NR_UMOWY, IMIE_NAZWISKO, …) wg docs/12,
        //  - małe litery 1:1 z danymi rezerwacji (numer_umowy, imie, kwota, …).
        $replacements = self::buildReplacements($vars);
        foreach ($vars as $key => $value) {
            $replacements[$key] = trim((string) $value) === '' ? '—' : (string) $value;
        }

        $res = Http::request(
            'POST',
            $url,
            ['Content-Type' => 'application/json'],
            json_encode([
                'secret' => $secret,
                'name' => $name,
                'replacements' => $replacements,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            30,
            true // Apps Script przekierowuje (302)
        );

        $body = $res['body'];
        if (!is_array($body)) {
            // Web-app zwrócił nie-JSON (zwykle stronę logowania Google = dostęp wdrożenia inny niż „Wszyscy",
            // albo użyto adresu /dev zamiast /exec). Pokazujemy fragment odpowiedzi do diagnozy.
            $snippet = trim(preg_replace('/\s+/', ' ', strip_tags((string) $body)));
            $hint = stripos((string) $body, 'sign in') !== false || stripos((string) $body, 'zaloguj') !== false
                ? ' — wygląda na stronę logowania Google: w Apps Script ustaw wdrożenie „Kto ma dostęp: Wszyscy" i użyj adresu kończącego się na /exec.'
                : '';
            throw new \RuntimeException(
                'Apps Script zwrócił nie-JSON (HTTP ' . $res['status'] . ')' . $hint
                . ' Odpowiedź: ' . mb_substr($snippet, 0, 180)
            );
        }
        if (!empty($body['error'])) {
            throw new \RuntimeException('Apps Script: ' . $body['error']);
        }
        if (empty($body['pdf_base64'])) {
            throw new \RuntimeException('Apps Script nie zwrócił PDF — zaktualizuj kod skryptu (pole pdf_base64).');
        }

        $pdf = base64_decode((string) $body['pdf_base64'], true);
        if ($pdf === false || strncmp($pdf, '%PDF', 4) !== 0) {
            throw new \RuntimeException('Apps Script zwrócił nieprawidłowy plik PDF.');
        }
        $dir = self::storageDir($contractId);
        file_put_contents("$dir/contract.pdf", $pdf);
        Database::update('contracts', [
            'pdf_path' => "$dir/contract.pdf",
            'html_path' => null, // źródłem jest Google Docs, nie nasz HTML
            'drive_file_id' => $body['doc_id'] ?? null,
            'drive_url' => $body['url'] ?? null,
        ], 'id = ?', [$contractId]);
    }
}
