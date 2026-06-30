<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\BookingService;
use App\Services\SigningService;

/**
 * Podpisywanie umów (SMS OTP + Brevo).
 * CRM: generowanie umów + ETAP 1 (podpis właściciela). Panel klienta: ETAP 2 (podpis klienta).
 */
class SigningController
{
    // ──────────────────────────────────────────────────────────────────────
    // CRM — generowanie i stan umowy
    // ──────────────────────────────────────────────────────────────────────

    public function adminContract(Request $request): Response
    {
        $bookingId = (int) $request->params['id'];
        $contract = SigningService::activeForBooking($bookingId);
        if ($contract === null) {
            return Response::json(['contract' => null]);
        }
        return Response::json($this->present($contract, true));
    }

    public function generateStandard(Request $request): Response
    {
        try {
            $contract = SigningService::generateStandard((int) $request->params['id'], $request->userId());
            return Response::json($this->present($contract, true), 201);
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
    }

    /** Wgranie niestandardowego PDF. */
    public function uploadCustom(Request $request): Response
    {
        $file = $_FILES['file'] ?? null;
        if ($file === null || $file['error'] !== UPLOAD_ERR_OK) {
            return Response::error('Nie przesłano pliku PDF', 422);
        }
        if (($file['size'] ?? 0) > 20 * 1024 * 1024) {
            return Response::error('Plik jest za duży (maks. 20 MB)', 422);
        }
        if ((mime_content_type($file['tmp_name']) ?: '') !== 'application/pdf') {
            return Response::error('Dozwolony jest wyłącznie plik PDF', 422);
        }
        try {
            $contract = SigningService::activeForBooking((int) $request->params['id']);
            if ($contract === null) {
                // brak aktywnej umowy — utwórz numer + storage (bez wymogu PDF z Drive)
                $contract = SigningService::generateUploadShell((int) $request->params['id'], $request->userId());
            }
            $updated = SigningService::uploadCustomPdf((int) $contract['id'], $file['tmp_name']);
            return Response::json($this->present($updated, true));
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
    }

    /** Hash dokumentu + przejście do etapu podpisu właściciela. */
    public function startSigning(Request $request): Response
    {
        try {
            $contract = SigningService::startSigning((int) $request->params['id']);
            return Response::json($this->present($contract, true));
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
    }

    public function ownerSendCode(Request $request): Response
    {
        try {
            return Response::json(SigningService::ownerSendCode((int) $request->params['id']));
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
    }

    public function ownerVerifyCode(Request $request): Response
    {
        $code = trim((string) $request->input('code', ''));
        if (!preg_match('/^\d{6}$/', $code)) {
            return Response::error('Podaj 6-cyfrowy kod', 422);
        }
        $result = SigningService::ownerVerifyCode(
            (int) $request->params['id'],
            $code,
            $this->clientIp(),
            (string) $request->header('user-agent')
        );
        return $result['ok']
            ? Response::json(['ok' => true])
            : Response::error($result['error'], 422);
    }

    public function notifyClient(Request $request): Response
    {
        try {
            return Response::json(SigningService::notifyClient((int) $request->params['id']));
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
    }

    public function adminPreviewPdf(Request $request): Response
    {
        $contract = SigningService::find((int) $request->params['id']);
        if ($contract === null) {
            return Response::notFound('Umowa nie istnieje');
        }
        return $this->streamPdf($contract['pdf_path'] ?? null);
    }

    public function adminSignedPdf(Request $request): Response
    {
        $contract = SigningService::find((int) $request->params['id']);
        if ($contract === null) {
            return Response::notFound('Umowa nie istnieje');
        }
        return $this->streamPdf($contract['signed_pdf_path'] ?? null, 'inline');
    }

    // ──────────────────────────────────────────────────────────────────────
    // Panel klienta — ETAP 2
    // ──────────────────────────────────────────────────────────────────────

    /** Komunikat blokady: bez zweryfikowanego e-maila nie wolno podejrzeć ani podpisać umowy. */
    private const VERIFY_MSG = 'Najpierw potwierdź swój adres e-mail — bez tego nie można wyświetlić ani podpisać umowy. Link aktywacyjny wysłaliśmy na Twoją skrzynkę.';

    /** Czy konto klienta tej rezerwacji ma zweryfikowany e-mail. */
    private function emailVerified(array $booking): bool
    {
        $u = Database::selectOne('SELECT email_verified_at FROM users WHERE id = ?', [(int) $booking['user_id']]);
        return !empty($u['email_verified_at']);
    }

    /** Zwraca odpowiedź 403, jeśli e-mail nie jest zweryfikowany (inaczej null). */
    private function requireVerified(array $booking): ?Response
    {
        return $this->emailVerified($booking) ? null : Response::error(self::VERIFY_MSG, 403);
    }

    public function clientContract(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $contract = SigningService::activeForBooking((int) $booking['id']);
        if ($contract === null) {
            return Response::json(['contract' => null]);
        }
        $data = $this->present($contract, false);
        $data['email_verified'] = $this->emailVerified($booking); // front blokuje podgląd/podpis
        return Response::json($data);
    }

    public function clientPreviewPdf(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        if ($blocked = $this->requireVerified($booking)) {
            return $blocked; // brak weryfikacji = brak dostępu do dokumentu
        }
        $contract = SigningService::activeForBooking((int) $booking['id']);
        return $this->streamPdf($contract['pdf_path'] ?? null);
    }

    public function clientConfirmRead(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        if ($blocked = $this->requireVerified($booking)) {
            return $blocked;
        }
        $contract = SigningService::activeForBooking((int) $booking['id']);
        if ($contract === null) {
            return Response::error('Brak umowy do podpisania', 404);
        }
        SigningService::clientConfirmRead((int) $contract['id']);
        return Response::json(['ok' => true]);
    }

    public function clientSendCode(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        if ($blocked = $this->requireVerified($booking)) {
            return $blocked;
        }
        // Imię i nazwisko osoby podpisującej (widnieje na umowie) — wymagane przed wysłaniem SMS.
        $first = trim((string) $request->input('first_name', ''));
        $last = trim((string) $request->input('last_name', ''));
        if ($first === '' || $last === '') {
            return Response::error('Podaj imię i nazwisko osoby podpisującej umowę', 422);
        }
        Database::update('users', ['first_name' => $first, 'last_name' => $last], 'id = ?', [(int) $booking['user_id']]);

        $contract = SigningService::activeForBooking((int) $booking['id']);
        if ($contract === null) {
            return Response::error('Brak umowy do podpisania', 404);
        }
        try {
            $booking = BookingService::find((int) $booking['id']); // świeże imię/nazwisko
            return Response::json(SigningService::clientSendCode((int) $contract['id'], $booking));
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
    }

    public function clientVerifyCode(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        if ($blocked = $this->requireVerified($booking)) {
            return $blocked;
        }
        $contract = SigningService::activeForBooking((int) $booking['id']);
        if ($contract === null) {
            return Response::error('Brak umowy do podpisania', 404);
        }
        $code = trim((string) $request->input('code', ''));
        if (!preg_match('/^\d{6}$/', $code)) {
            return Response::error('Podaj 6-cyfrowy kod', 422);
        }
        $result = SigningService::clientVerifyCode(
            (int) $contract['id'],
            $booking,
            $code,
            $this->clientIp(),
            (string) $request->header('user-agent')
        );
        return $result['ok']
            ? Response::json(['ok' => true])
            : Response::error($result['error'], 422);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Pomocnicze
    // ──────────────────────────────────────────────────────────────────────

    private function present(array $contract, bool $admin): array
    {
        // Ścieżki względem bazy API (klient axios dokleja prefiks /api)
        $id = (int) $contract['id'];
        $base = $admin ? "/admin/contracts/$id" : "/bookings/{$contract['booking_id']}/contract";
        return [
            'contract' => [
                'id' => $id,
                'booking_id' => (int) $contract['booking_id'],
                'number' => $contract['number'],
                'type' => $contract['type'],
                'signing_status' => $contract['signing_status'],
                'document_hash' => $contract['document_hash'],
                'has_pdf' => !empty($contract['pdf_path']),
                'doc_url' => $contract['drive_url'] ?? null,
                'drive_signed_url' => $contract['drive_signed_url'] ?? null,
                'owner_signed_at' => $contract['owner_signed_at'],
                'client_signed_at' => $contract['client_signed_at'],
                'preview_url' => "$base/preview",
                'signed_pdf_url' => $admin && !empty($contract['signed_pdf_path']) ? "$base/signed-pdf" : null,
            ],
            'signatures' => SigningService::signatures($id),
            'events' => SigningService::timeline($id),
        ];
    }

    private function ownBooking(Request $request): ?array
    {
        $booking = BookingService::find((int) $request->params['id']);
        return $booking !== null && (int) $booking['user_id'] === $request->userId() ? $booking : null;
    }

    private function clientContractOrFail(Request $request): array|Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $contract = SigningService::activeForBooking((int) $booking['id']);
        if ($contract === null) {
            return Response::error('Brak umowy', 404);
        }
        return $contract;
    }

    private function streamPdf(?string $path, string $disposition = 'inline'): Response
    {
        if ($path === null || !is_file($path)) {
            return Response::notFound('Plik PDF nie istnieje');
        }
        header('Content-Type: application/pdf');
        header("Content-Disposition: $disposition; filename=\"umowa.pdf\"");
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, no-store');
        readfile($path);
        exit;
    }

    private function clientIp(): string
    {
        // Za Cloudflare prawdziwy IP klienta jest w CF-Connecting-IP (patrz BookingController::clientIp).
        $cf = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '';
        if ($cf !== '') {
            return trim($cf);
        }
        $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if ($forwarded !== '') {
            return trim(explode(',', $forwarded)[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
