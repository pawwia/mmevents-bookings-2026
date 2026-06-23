<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Własny moduł podpisywania umów (SMS OTP + Brevo) — zastępuje Pergamin.
 *
 * Przebieg:
 *  1. Generowanie umowy (standardowa / edytowalna / wgrana) → PDF w storage.
 *  2. startSigning → hash SHA-256 dokumentu (niezmienny do końca procesu), status pending_owner.
 *  3. ETAP 1 — właściciel: OTP SMS → owner_signed.
 *  4. ETAP 2 — klient: powiadomienie SMS+email → przewinięcie → OTP SMS → fully_signed.
 *  5. Finalizacja: PDF z dołączoną stroną potwierdzenia → Drive + e-maile z załącznikiem.
 */
final class SigningService
{
    /** Aktywna (niewycofana) umowa rezerwacji. */
    public static function activeForBooking(int $bookingId): ?array
    {
        return Database::selectOne(
            "SELECT * FROM contracts WHERE booking_id = ? AND signing_status != 'cancelled' ORDER BY id DESC LIMIT 1",
            [$bookingId]
        );
    }

    public static function find(int $contractId): ?array
    {
        return Database::selectOne('SELECT * FROM contracts WHERE id = ?', [$contractId]);
    }

    public static function event(int $contractId, string $type, string $message, array $meta = []): void
    {
        Database::insert('contract_events', [
            'contract_id' => $contractId,
            'type' => $type,
            'message' => $message,
            'meta' => $meta === [] ? null : json_encode($meta, JSON_UNESCAPED_UNICODE),
        ]);
    }

    public static function timeline(int $contractId): array
    {
        return Database::select(
            'SELECT type, message, created_at FROM contract_events WHERE contract_id = ? ORDER BY id',
            [$contractId]
        );
    }

    public static function signatures(int $contractId): array
    {
        return Database::select(
            'SELECT party, signed_at, ip, phone, otp_identifier FROM contract_signatures WHERE contract_id = ? ORDER BY id',
            [$contractId]
        );
    }

    /** Wycofuje aktywne umowy rezerwacji (przed wygenerowaniem nowej). */
    public static function cancelActive(int $bookingId): void
    {
        Database::execute(
            "UPDATE contracts SET status = 'cancelled', signing_status = 'cancelled'
             WHERE booking_id = ? AND signing_status != 'cancelled'",
            [$bookingId]
        );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Generowanie umów
    // ──────────────────────────────────────────────────────────────────────

    /** Standardowa umowa: szablon Google Docs → PDF. */
    public static function generateStandard(int $bookingId, int $adminId): array
    {
        self::cancelActive($bookingId);
        $contract = ContractService::generate($bookingId, $adminId, 'standard', true);
        if (empty($contract['pdf_path'])) {
            throw new \RuntimeException('Nie udało się wygenerować PDF umowy — sprawdź konfigurację Google Drive (szablon umowy i folder).');
        }
        self::event((int) $contract['id'], 'contract_generated', 'Umowa standardowa wygenerowana', ['number' => $contract['number']]);
        return self::find((int) $contract['id']);
    }

    /**
     * Tworzy „pustą" umowę (numer + storage) pod wgranie własnego PDF.
     * Dla ścieżki „Wgraj umowę niestandardową", gdy nie ma jeszcze aktywnej umowy.
     */
    public static function generateUploadShell(int $bookingId, int $adminId): array
    {
        self::cancelActive($bookingId);
        $contract = ContractService::generate($bookingId, $adminId, 'uploaded', false);
        self::event((int) $contract['id'], 'contract_generated', 'Utworzono umowę pod wgranie pliku PDF', ['number' => $contract['number']]);
        return self::find((int) $contract['id']);
    }

    /** Wgranie niestandardowego PDF (zewnętrznego) do aktywnej umowy. */
    public static function uploadCustomPdf(int $contractId, string $tmpPath): array
    {
        $contract = self::find($contractId);
        if ($contract === null) {
            throw new \RuntimeException('Umowa nie istnieje.');
        }
        if ($contract['signing_status'] !== 'draft') {
            throw new \RuntimeException('Nie można podmienić umowy po rozpoczęciu podpisywania.');
        }
        $dir = ContractService::storageDir($contractId);
        $dest = "$dir/contract.pdf";
        if (!move_uploaded_file($tmpPath, $dest)) {
            throw new \RuntimeException('Nie udało się zapisać wgranego pliku PDF.');
        }
        // html_path = NULL → finalize potraktuje umowę jako wgrany PDF (scalenie), nie szablon HTML
        Database::update('contracts', ['type' => 'uploaded', 'pdf_path' => $dest, 'html_path' => null], 'id = ?', [$contractId]);
        self::event($contractId, 'contract_uploaded', 'Wgrano niestandardową umowę PDF');
        return self::find($contractId);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Proces podpisywania
    // ──────────────────────────────────────────────────────────────────────

    /** Hash SHA-256 dokumentu i przejście do etapu podpisu właściciela. */
    public static function startSigning(int $contractId): array
    {
        $contract = self::requireContract($contractId);
        if (empty($contract['pdf_path']) || !is_file($contract['pdf_path'])) {
            throw new \RuntimeException('Brak pliku PDF umowy — wygeneruj lub wgraj umowę.');
        }
        if ($contract['signing_status'] !== 'draft') {
            return $contract; // proces już rozpoczęty — hash niezmienny
        }
        $hash = hash_file('sha256', $contract['pdf_path']);
        Database::update('contracts', [
            'document_hash' => $hash,
            'hash_generated_at' => date('Y-m-d H:i:s'),
            'signing_status' => 'pending_owner',
        ], 'id = ?', [$contractId]);
        self::event($contractId, 'hash_generated', 'Hash dokumentu SHA-256 wygenerowany', ['hash' => $hash]);

        $booking = BookingService::find((int) $contract['booking_id']);
        if ($booking !== null && $booking['status'] === 'new') {
            BookingService::changeStatus((int) $contract['booking_id'], 'awaiting_contract', null, 'Rozpoczęto podpisywanie umowy');
        }
        return self::find($contractId);
    }

    /** ETAP 1 — wysyłka kodu OTP do właściciela (numer z ustawień). */
    public static function ownerSendCode(int $contractId): array
    {
        $contract = self::requireContract($contractId);
        if (!in_array($contract['signing_status'], ['pending_owner'], true)) {
            throw new \RuntimeException('Umowa nie jest na etapie podpisu właściciela.');
        }
        $phone = trim((string) SettingsService::get('signing.owner_phone', ''));
        if ($phone === '') {
            throw new \RuntimeException('Uzupełnij numer telefonu właściciela (Ustawienia → Podpis umów).');
        }
        $otp = OtpService::issue($contractId, 'owner', $phone);
        self::sendOtpSms($phone, (string) $contract['number'], $otp['code']);
        self::event($contractId, 'owner_code_sent', 'Wysłano kod SMS do właściciela', ['phone' => self::maskPhone($phone)]);
        return ['ok' => true, 'phone' => self::maskPhone($phone)];
    }

    /** ETAP 1 — weryfikacja kodu właściciela → OWNER_SIGNED. */
    public static function ownerVerifyCode(int $contractId, string $code, string $ip, string $userAgent): array
    {
        $contract = self::requireContract($contractId);
        if ($contract['signing_status'] !== 'pending_owner') {
            throw new \RuntimeException('Umowa nie jest na etapie podpisu właściciela.');
        }
        $phone = trim((string) SettingsService::get('signing.owner_phone', ''));
        $result = OtpService::verify($contractId, 'owner', $code);
        if (!$result['ok']) {
            return ['ok' => false, 'error' => $result['error']];
        }
        $now = date('Y-m-d H:i:s');
        self::recordSignature($contractId, 'owner', $phone, $result['otp_identifier'], (string) $contract['document_hash'], $ip, $userAgent, $now);
        Database::update('contracts', ['signing_status' => 'owner_signed', 'owner_signed_at' => $now], 'id = ?', [$contractId]);
        self::event($contractId, 'owner_signed', 'Właściciel podpisał umowę', ['ip' => $ip]);
        return ['ok' => true];
    }

    /** ETAP 2 — powiadomienie klienta (SMS + email) o oczekującym podpisie. */
    public static function notifyClient(int $contractId): array
    {
        $contract = self::requireContract($contractId);
        if (!in_array($contract['signing_status'], ['owner_signed', 'pending_client'], true)) {
            throw new \RuntimeException('Najpierw musi podpisać właściciel.');
        }
        $booking = BookingService::find((int) $contract['booking_id']);
        $vars = [
            'imie' => $booking['first_name'],
            'numer_umowy' => $contract['number'],
            'link_panelu' => rtrim((string) SettingsService::get('app.frontend_url', ''), '/') . '/konto/rezerwacje/' . $booking['id'],
            'stopka' => nl2br((string) SettingsService::get('company.email_footer', '')),
        ];
        MailerService::queueEmail('contract_awaiting_client', $booking['email'], $booking['first_name'], $vars, (int) $booking['id']);
        MailerService::queueSms('contract_awaiting_client', (string) $booking['phone'], $vars, (int) $booking['id']);

        Database::update('contracts', ['signing_status' => 'pending_client'], 'id = ?', [$contractId]);
        self::event($contractId, 'client_notified', 'Wysłano SMS i e-mail z prośbą o podpis klienta', ['email' => $booking['email']]);
        return ['ok' => true];
    }

    /** ETAP 2 — klient potwierdza zapoznanie się z treścią (po przewinięciu). */
    public static function clientConfirmRead(int $contractId): void
    {
        self::event($contractId, 'client_read', 'Klient potwierdził zapoznanie się z treścią umowy');
    }

    /** ETAP 2 — wysyłka kodu OTP do klienta. */
    public static function clientSendCode(int $contractId, array $booking): array
    {
        $contract = self::requireContract($contractId);
        if (!in_array($contract['signing_status'], ['owner_signed', 'pending_client'], true)) {
            throw new \RuntimeException('Umowa nie oczekuje na podpis klienta.');
        }
        // Bez zweryfikowanego adresu e-mail nie pozwalamy podpisać umowy.
        $account = Database::selectOne('SELECT email_verified_at FROM users WHERE id = ?', [(int) $booking['user_id']]);
        if (empty($account['email_verified_at'])) {
            throw new \RuntimeException('Najpierw potwierdź swój adres e-mail — link aktywacyjny wysłaliśmy na Twoją skrzynkę.');
        }
        $phone = trim((string) $booking['phone']);
        if ($phone === '') {
            throw new \RuntimeException('Brak numeru telefonu klienta.');
        }
        $otp = OtpService::issue($contractId, 'client', $phone);
        self::sendOtpSms($phone, (string) $contract['number'], $otp['code']);
        self::event($contractId, 'client_code_sent', 'Wysłano kod SMS do klienta', ['phone' => self::maskPhone($phone)]);
        return ['ok' => true, 'phone' => self::maskPhone($phone)];
    }

    /** ETAP 2 — weryfikacja kodu klienta → CLIENT_SIGNED → finalizacja. */
    public static function clientVerifyCode(int $contractId, array $booking, string $code, string $ip, string $userAgent): array
    {
        $contract = self::requireContract($contractId);
        if (!in_array($contract['signing_status'], ['owner_signed', 'pending_client'], true)) {
            throw new \RuntimeException('Umowa nie oczekuje na podpis klienta.');
        }
        $result = OtpService::verify($contractId, 'client', $code);
        if (!$result['ok']) {
            return ['ok' => false, 'error' => $result['error']];
        }
        $now = date('Y-m-d H:i:s');
        self::recordSignature($contractId, 'client', (string) $booking['phone'], $result['otp_identifier'], (string) $contract['document_hash'], $ip, $userAgent, $now);
        Database::update('contracts', [
            'signing_status' => 'fully_signed',
            'client_signed_at' => $now,
            'fully_signed_at' => $now,
            'status' => 'signed',
            'signed_at' => $now,
        ], 'id = ?', [$contractId]);
        self::event($contractId, 'client_signed', 'Klient podpisał umowę', ['ip' => $ip]);

        self::finalize($contractId);
        return ['ok' => true];
    }

    // ──────────────────────────────────────────────────────────────────────
    // Finalizacja
    // ──────────────────────────────────────────────────────────────────────

    /** Generuje końcowy PDF (umowa + strona potwierdzenia), zapisuje na Drive, wysyła e-maile. */
    public static function finalize(int $contractId): void
    {
        $contract = self::requireContract($contractId);
        $booking = BookingService::find((int) $contract['booking_id']);
        $signatures = [];
        foreach (self::signatures($contractId) as $sig) {
            $signatures[$sig['party']] = $sig;
        }

        $confirmationData = [
            'numer_umowy' => $contract['number'],
            'hash' => $contract['document_hash'],
            'generated_at' => date('d.m.Y H:i', strtotime($contract['created_at'])),
            'owner_signed_at' => isset($signatures['owner']) ? date('d.m.Y H:i', strtotime($signatures['owner']['signed_at'])) : '',
            'owner_phone' => $signatures['owner']['phone'] ?? SettingsService::get('signing.owner_phone', ''),
            'owner_ip' => $signatures['owner']['ip'] ?? '',
            'owner_otp' => $signatures['owner']['otp_identifier'] ?? '',
            'client_signed_at' => isset($signatures['client']) ? date('d.m.Y H:i', strtotime($signatures['client']['signed_at'])) : '',
            'client_phone' => $signatures['client']['phone'] ?? $booking['phone'],
            'client_ip' => $signatures['client']['ip'] ?? '',
            'client_otp' => $signatures['client']['otp_identifier'] ?? '',
        ];

        // Umowy z szablonu HTML: render treść + strona potwierdzenia w jednym PDF (pełne PL).
        // Umowy wgrane jako PDF: dołączamy stronę potwierdzenia przez scalenie (FPDI).
        $mergeFailed = false;
        if (!empty($contract['html_path']) && is_file($contract['html_path'])) {
            $signedBytes = PdfService::buildSignedFromHtml((string) file_get_contents($contract['html_path']), $confirmationData);
        } else {
            $built = PdfService::buildSignedFromPdf((string) file_get_contents($contract['pdf_path']), $confirmationData);
            $signedBytes = $built['bytes'];
            $mergeFailed = !$built['merged'];
        }

        $dir = ContractService::storageDir($contractId);
        $signedPath = "$dir/signed.pdf";
        file_put_contents($signedPath, $signedBytes);
        Database::update('contracts', ['signed_pdf_path' => $signedPath], 'id = ?', [$contractId]);
        self::event($contractId, 'signed_pdf_built', 'Wygenerowano końcowy PDF ze stroną potwierdzenia');

        // Opcjonalny zapis na Google Drive (jeśli skonfigurowany) — folder per zlecenie albo domyślny
        $folderId = $contract['signed_folder_id']
            ?: SettingsService::get('drive.signed_contracts_folder_id')
            ?: SettingsService::get('drive.contracts_folder_id');
        if ($folderId) {
            try {
                $fileName = 'Umowa podpisana ' . str_replace('/', '-', (string) $contract['number']) . '.pdf';
                $drive = GoogleDriveService::uploadFile($fileName, $signedBytes, 'application/pdf', $folderId);
                Database::update('contracts', [
                    'drive_signed_file_id' => $drive['id'],
                    'drive_signed_url' => $drive['url'],
                ], 'id = ?', [$contractId]);
                self::event($contractId, 'drive_saved', 'Podpisana umowa zapisana na Google Drive');
            } catch (\Throwable $e) {
                error_log('SigningService Drive: ' . $e->getMessage());
                self::event($contractId, 'drive_error', 'Nie udało się zapisać na Drive: ' . $e->getMessage());
            }
        }

        // E-maile z załącznikiem (klient + właściciel).
        // Gdy wgranego PDF nie udało się scalić — załączamy też oryginał osobno.
        if ($mergeFailed && !empty($contract['pdf_path']) && is_file($contract['pdf_path'])) {
            self::event($contractId, 'merge_skipped', 'Wgrany PDF nie pozwolił na scalenie — strona potwierdzenia jako osobny dokument');
        }
        $attachName = 'Umowa ' . str_replace('/', '-', (string) $contract['number']) . '.pdf';
        $clientVars = [
            'imie' => $booking['first_name'],
            'numer_umowy' => $contract['number'],
            'stopka' => nl2br((string) SettingsService::get('company.email_footer', '')),
        ];
        MailerService::queueEmail('contract_signed_copy', $booking['email'], $booking['first_name'], $clientVars, (int) $booking['id'], $signedPath, $attachName);
        self::event($contractId, 'client_copy_sent', 'E-mail z podpisaną umową zakolejkowany do klienta');

        $ownerEmail = SettingsService::get('company.email');
        if ($ownerEmail) {
            $ownerVars = [
                'imie' => SettingsService::get('signing.owner_name', 'MMEvent'),
                'numer_umowy' => $contract['number'],
                'stopka' => nl2br((string) SettingsService::get('company.email_footer', '')),
            ];
            MailerService::queueEmail('contract_signed_copy', $ownerEmail, $ownerVars['imie'], $ownerVars, (int) $booking['id'], $signedPath, $attachName);
            self::event($contractId, 'owner_copy_sent', 'E-mail z podpisaną umową zakolejkowany do właściciela');
        }

        // Po pełnym podpisie umowa otwiera etap zadatku
        if ($booking['status'] === 'awaiting_contract') {
            BookingService::changeStatus((int) $booking['id'], 'awaiting_deposit', null, 'Umowa podpisana (SMS OTP obu stron)');
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Pomocnicze
    // ──────────────────────────────────────────────────────────────────────

    private static function requireContract(int $contractId): array
    {
        $contract = self::find($contractId);
        if ($contract === null) {
            throw new \RuntimeException('Umowa nie istnieje.');
        }
        return $contract;
    }

    private static function recordSignature(
        int $contractId, string $party, string $phone, ?string $otpId,
        string $hash, string $ip, string $userAgent, string $signedAt,
    ): void {
        Database::insert('contract_signatures', [
            'contract_id' => $contractId,
            'party' => $party,
            'signed_at' => $signedAt,
            'ip' => $ip,
            'user_agent' => mb_substr($userAgent, 0, 500),
            'phone' => $phone,
            'otp_identifier' => $otpId,
            'document_hash' => $hash,
        ]);
    }

    private static function sendOtpSms(string $phone, string $number, string $code): void
    {
        $template = Database::selectOne("SELECT body FROM sms_templates WHERE code = 'otp_code' AND is_active = 1");
        $message = $template !== null
            ? MailerService::render($template['body'], ['numer_umowy' => $number, 'kod' => $code])
            : "mmevents.pl: kod do podpisu umowy $number: $code. Wazny 10 minut.";
        SmsApiService::send($phone, $message);
    }

    private static function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\s+/', '', $phone);
        return strlen($digits) > 4 ? str_repeat('•', strlen($digits) - 3) . substr($digits, -3) : $digits;
    }
}
