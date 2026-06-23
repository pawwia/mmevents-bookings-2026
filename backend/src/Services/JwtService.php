<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;

/** JWT HS256 bez zewnętrznych zależności — łatwy deploy FTP na LH.pl. */
final class JwtService
{
    public static function issue(array $user): string
    {
        $now = time();
        $payload = [
            'sub' => (int) $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'iat' => $now,
            'exp' => $now + (int) (Config::get('JWT_TTL', '86400')),
        ];
        $header = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body = self::b64(json_encode($payload));
        $signature = self::b64(hash_hmac('sha256', "$header.$body", self::secret(), true));
        return "$header.$body.$signature";
    }

    /** Zwraca payload albo null gdy token nieprawidłowy/wygasły. */
    public static function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$header, $body, $signature] = $parts;
        $expected = self::b64(hash_hmac('sha256', "$header.$body", self::secret(), true));
        if (!hash_equals($expected, $signature)) {
            return null;
        }
        $payload = json_decode(self::unb64($body), true);
        if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) {
            return null;
        }
        return $payload;
    }

    private static function secret(): string
    {
        $secret = Config::get('JWT_SECRET', '');
        if ($secret === '') {
            throw new \RuntimeException('JWT_SECRET nie jest skonfigurowany w .env');
        }
        return $secret;
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}
