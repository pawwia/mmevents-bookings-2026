<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Cloudflare Turnstile — weryfikacja tokenu CAPTCHA po stronie serwera.
 * Gdy Secret Key nie jest skonfigurowany, weryfikacja jest pomijana (funkcja nieaktywna).
 */
final class CloudflareService
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public static function enabled(): bool
    {
        return trim((string) SettingsService::get('security.turnstile_secret_key', '')) !== '';
    }

    /**
     * Zwraca true, gdy token poprawny LUB gdy Turnstile nie jest skonfigurowany.
     * Przy błędzie sieci (nasza infrastruktura) — fail-open, by nie blokować klientów.
     */
    public static function verify(?string $token, ?string $ip): bool
    {
        $secret = trim((string) SettingsService::get('security.turnstile_secret_key', ''));
        if ($secret === '') {
            return true; // nieskonfigurowane → pomijamy
        }
        if ($token === null || trim($token) === '') {
            return false; // skonfigurowane, ale brak tokenu = odrzucamy
        }
        try {
            $res = Http::request(
                'POST',
                self::VERIFY_URL,
                ['Content-Type' => 'application/x-www-form-urlencoded'],
                http_build_query([
                    'secret' => $secret,
                    'response' => $token,
                    'remoteip' => $ip ?? '',
                ])
            );
            return is_array($res['body']) && ($res['body']['success'] ?? false) === true;
        } catch (\Throwable $e) {
            error_log('Turnstile verify: ' . $e->getMessage());
            return true; // problem z połączeniem do Cloudflare — nie blokujemy ruchu
        }
    }
}
