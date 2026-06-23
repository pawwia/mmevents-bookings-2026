<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Cloudflare Turnstile — weryfikacja tokenu CAPTCHA po stronie serwera.
 * Gdy Secret Key nie jest skonfigurowany, weryfikacja jest pomijana (funkcja nieaktywna).
 */
final class CloudflareService
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    /** Jak długo (s) po przejściu Turnstile ufamy danemu IP bez kolejnego tokenu. */
    private const TRUST_TTL = 7200;

    public static function enabled(): bool
    {
        return trim((string) SettingsService::get('security.turnstile_secret_key', '')) !== '';
    }

    /** Zapamiętuje, że dane IP przeszło weryfikację człowieka (na TRUST_TTL). */
    public static function markVerified(string $ip): void
    {
        try {
            Database::execute(
                'INSERT INTO human_verifications (ip, verified_until) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE verified_until = VALUES(verified_until)',
                [$ip, date('Y-m-d H:i:s', time() + self::TRUST_TTL)]
            );
        } catch (\Throwable $e) {
            error_log('Turnstile markVerified: ' . $e->getMessage()); // brak tabeli ≠ błąd dla klienta
        }
    }

    /** Czy IP przeszło już weryfikację i jest jeszcze ważna. */
    public static function isVerified(string $ip): bool
    {
        try {
            $row = Database::selectOne('SELECT verified_until FROM human_verifications WHERE ip = ?', [$ip]);
            return $row !== null && strtotime((string) $row['verified_until']) > time();
        } catch (\Throwable $e) {
            error_log('Turnstile isVerified: ' . $e->getMessage());
            return false;
        }
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
