<?php

declare(strict_types=1);

namespace App\Services;

/**
 * PayNow (mBank) — przygotowane technicznie, domyślnie WYŁĄCZONE (paynow.enabled = 0).
 * Klient widzi wyłącznie przelew tradycyjny dopóki administrator nie włączy PayNow w CRM.
 */
final class PayNowService
{
    public static function enabled(): bool
    {
        return SettingsService::bool('paynow.enabled')
            && SettingsService::get('paynow.api_key')
            && SettingsService::get('paynow.signature_key');
    }

    private static function baseUrl(): string
    {
        return SettingsService::bool('paynow.sandbox', true)
            ? 'https://api.sandbox.paynow.pl'
            : 'https://api.paynow.pl';
    }

    /** Inicjuje płatność zadatku. Zwraca ['payment_id' => ..., 'redirect_url' => ...]. */
    public static function createPayment(array $booking, array $user, float $amount): array
    {
        if (!self::enabled()) {
            throw new \RuntimeException('PayNow jest wyłączony');
        }
        $body = json_encode([
            'amount' => (int) round($amount * 100),
            'currency' => SettingsService::get('finance.currency', 'PLN'),
            'externalId' => 'booking-' . $booking['id'] . '-' . time(),
            'description' => 'Zadatek — rezerwacja #' . $booking['id'] . ' (' . $booking['event_date'] . ')',
            'buyer' => ['email' => $user['email']],
            'continueUrl' => SettingsService::frontendUrl() . '/konto/rezerwacje/' . $booking['id'],
        ], JSON_UNESCAPED_UNICODE);

        $idempotencyKey = bin2hex(random_bytes(16));
        $res = Http::request('POST', self::baseUrl() . '/v1/payments', [
            'Api-Key' => SettingsService::get('paynow.api_key'),
            'Signature' => self::sign($body),
            'Idempotency-Key' => $idempotencyKey,
            'Content-Type' => 'application/json',
        ], $body);

        if ($res['status'] >= 300 || empty($res['body']['paymentId'])) {
            throw new \RuntimeException('PayNow: ' . json_encode($res['body'], JSON_UNESCAPED_UNICODE));
        }
        return [
            'payment_id' => $res['body']['paymentId'],
            'redirect_url' => $res['body']['redirectUrl'] ?? null,
        ];
    }

    public static function sign(string $body): string
    {
        return base64_encode(hash_hmac('sha256', $body, (string) SettingsService::get('paynow.signature_key'), true));
    }

    /** Weryfikacja sygnatury powiadomienia (webhook). */
    public static function verifyNotification(string $rawBody, ?string $signature): bool
    {
        return $signature !== null && hash_equals(self::sign($rawBody), $signature);
    }
}
