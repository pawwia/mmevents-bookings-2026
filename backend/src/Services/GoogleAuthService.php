<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Tryby uwierzytelniania Google:
 *  1. Weryfikacja ID tokenu z Google OAuth (logowanie klientów).
 *  2. Token dostępowy z Service Account (RS256) — Calendar (i Drive na Workspace).
 *  3. Token dostępowy OAuth właściciela (refresh token) — Drive/Docs na zwykłym Gmailu,
 *     dzięki czemu kopie umów lądują na prywatnym Dysku właściciela (jego limit miejsca).
 */
final class GoogleAuthService
{
    private static array $tokenCache = [];

    public const DRIVE_SCOPES = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
    ];

    // ──────────────────────────────────────────────────────────────────────
    // OAuth Dysku na koncie właściciela (zwykłe Gmail)
    // ──────────────────────────────────────────────────────────────────────

    /** Czy skonfigurowano OAuth Dysku (jest refresh token). */
    public static function driveOAuthConnected(): bool
    {
        return trim((string) SettingsService::get('drive.oauth_refresh_token', '')) !== '';
    }

    /** URL zgody Google (offline + drive/docs) do połączenia konta właściciela. */
    public static function driveAuthUrl(string $redirectUri, string $state): string
    {
        $clientId = SettingsService::get('google.oauth_client_id');
        if (!$clientId) {
            throw new \RuntimeException('Najpierw uzupełnij Google OAuth Client ID (Ustawienia → Aplikacja).');
        }
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => implode(' ', self::DRIVE_SCOPES),
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state,
        ]);
    }

    /** Wymienia kod autoryzacyjny na tokeny; zapisuje refresh token i e-mail konta. */
    public static function exchangeDriveCode(string $code, string $redirectUri): array
    {
        $res = Http::request('POST', 'https://oauth2.googleapis.com/token', [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], http_build_query([
            'code' => $code,
            'client_id' => SettingsService::get('google.oauth_client_id'),
            'client_secret' => SettingsService::get('google.oauth_client_secret'),
            'redirect_uri' => $redirectUri,
            'grant_type' => 'authorization_code',
        ]));
        $body = $res['body'];
        if ($res['status'] >= 300 || empty($body['refresh_token'])) {
            $detail = is_array($body) ? json_encode($body, JSON_UNESCAPED_UNICODE) : (string) $body;
            throw new \RuntimeException('Nie udało się połączyć konta Google: ' . $detail);
        }
        $email = '';
        if (!empty($body['id_token'])) {
            $info = Http::getJson('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($body['id_token']));
            $email = $info['body']['email'] ?? '';
        }
        return ['refresh_token' => $body['refresh_token'], 'email' => $email];
    }

    /** Access token właściciela z zapisanego refresh tokenu (cache w obrębie żądania). */
    public static function driveUserAccessToken(): string
    {
        $cached = self::$tokenCache['drive_oauth'] ?? null;
        if ($cached !== null && $cached['expires'] > time() + 60) {
            return $cached['token'];
        }
        $refresh = SettingsService::get('drive.oauth_refresh_token');
        if (!$refresh) {
            throw new \RuntimeException('Konto Google Dysku nie jest połączone (Ustawienia → Google Drive).');
        }
        $res = Http::request('POST', 'https://oauth2.googleapis.com/token', [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], http_build_query([
            'client_id' => SettingsService::get('google.oauth_client_id'),
            'client_secret' => SettingsService::get('google.oauth_client_secret'),
            'refresh_token' => $refresh,
            'grant_type' => 'refresh_token',
        ]));
        $token = $res['body']['access_token'] ?? null;
        if (!$token) {
            throw new \RuntimeException('Nie udało się odświeżyć tokenu Google Dysku: ' . json_encode($res['body'], JSON_UNESCAPED_UNICODE));
        }
        self::$tokenCache['drive_oauth'] = ['token' => $token, 'expires' => time() + (int) ($res['body']['expires_in'] ?? 3600)];
        return $token;
    }

    /**
     * Token do operacji Drive/Docs: OAuth właściciela jeśli połączony, inaczej Service Account.
     */
    public static function driveAccessToken(): string
    {
        return self::driveOAuthConnected()
            ? self::driveUserAccessToken()
            : self::serviceAccountToken(self::DRIVE_SCOPES);
    }

    /** Weryfikuje ID token z przycisku "Zaloguj przez Google" i zwraca profil. */
    public static function verifyIdToken(string $idToken): ?array
    {
        $res = Http::getJson('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        $body = $res['body'];
        if ($res['status'] !== 200 || !is_array($body)) {
            return null;
        }
        $expectedClientId = SettingsService::get('google.oauth_client_id', '');
        if ($expectedClientId !== '' && ($body['aud'] ?? '') !== $expectedClientId) {
            return null;
        }
        if (($body['email_verified'] ?? 'false') !== 'true') {
            return null;
        }
        return [
            'google_id' => $body['sub'],
            'email' => $body['email'],
            'first_name' => $body['given_name'] ?? '',
            'last_name' => $body['family_name'] ?? '',
        ];
    }

    /**
     * Access token Service Account dla podanych zakresów (Drive/Calendar).
     * JWT RS256 podpisany kluczem z ustawienia drive.service_account_json.
     */
    public static function serviceAccountToken(array $scopes): string
    {
        $scopeKey = implode(' ', $scopes);
        $cached = self::$tokenCache[$scopeKey] ?? null;
        if ($cached !== null && $cached['expires'] > time() + 60) {
            return $cached['token'];
        }

        $json = SettingsService::get('drive.service_account_json');
        if (!$json) {
            throw new \RuntimeException('Brak konfiguracji Service Account (Ustawienia → Google Drive)');
        }
        $account = json_decode(trim($json), true);
        if (!is_array($account)) {
            throw new \RuntimeException(
                'Service Account: pole nie zawiera poprawnego JSON (' . json_last_error_msg() . ')'
                . ' — wklej całą, niezmienioną zawartość pliku .json.'
            );
        }
        if (empty($account['client_email']) || empty($account['private_key'])) {
            throw new \RuntimeException('Service Account: w JSON brakuje pól client_email lub private_key.');
        }

        $now = time();
        $header = self::b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claims = self::b64(json_encode([
            'iss' => $account['client_email'],
            'scope' => $scopeKey,
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ]));
        $signature = '';
        if (!openssl_sign("$header.$claims", $signature, $account['private_key'], OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('Nie udało się podpisać JWT kluczem Service Account');
        }
        $jwt = "$header.$claims." . self::b64($signature);

        $res = Http::request('POST', 'https://oauth2.googleapis.com/token', [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]));

        $token = $res['body']['access_token'] ?? null;
        if (!$token) {
            throw new \RuntimeException('Google nie wydało tokenu Service Account: ' . json_encode($res['body']));
        }
        self::$tokenCache[$scopeKey] = ['token' => $token, 'expires' => $now + (int) ($res['body']['expires_in'] ?? 3600)];
        return $token;
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
