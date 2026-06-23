<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Services\GoogleAuthService;
use App\Services\SettingsService;

/**
 * Połączenie konta Google właściciela (OAuth) dla Dysku/Docs — pliki umów lądują na jego
 * prywatnym Dysku (np. plan 100 GB), bez ograniczeń konta serwisowego.
 */
class GoogleOAuthController
{
    /** CRM: zwraca URL zgody Google do połączenia konta Dysku. */
    public function driveAuthUrl(Request $request): Response
    {
        $redirectUri = $this->callbackUrl();
        $state = $this->makeState();
        try {
            return Response::json([
                'url' => GoogleAuthService::driveAuthUrl($redirectUri, $state),
                'redirect_uri' => $redirectUri,
            ]);
        } catch (\RuntimeException $e) {
            return Response::error($e->getMessage(), 422);
        }
    }

    /**
     * Publiczny callback Google (redirect z przeglądarki po zgodzie). Wymienia kod na refresh
     * token, zapisuje go i przekierowuje do panelu ustawień. Ochrona: podpisany parametr state.
     */
    public function driveCallback(Request $request): Response
    {
        $frontend = SettingsService::frontendUrl();
        $error = (string) ($request->query['error'] ?? '');
        $code = (string) ($request->query['code'] ?? '');
        $state = (string) ($request->query['state'] ?? '');

        if ($error !== '' || $code === '' || !$this->verifyState($state)) {
            return $this->redirect($frontend . '/admin/ustawienia?google=error');
        }
        try {
            $tokens = GoogleAuthService::exchangeDriveCode($code, $this->callbackUrl());
            // Zapis z pominięciem maski sekretu (zapisujemy realny refresh token)
            SettingsService::set('drive.oauth_refresh_token', $tokens['refresh_token'], null);
            SettingsService::set('drive.oauth_account_email', $tokens['email'], null);
            return $this->redirect($frontend . '/admin/ustawienia?google=connected');
        } catch (\Throwable $e) {
            error_log('GoogleOAuth callback: ' . $e->getMessage());
            return $this->redirect($frontend . '/admin/ustawienia?google=error');
        }
    }

    /** CRM: rozłączenie konta Dysku. */
    public function driveDisconnect(Request $request): Response
    {
        SettingsService::set('drive.oauth_refresh_token', '', $request->userId());
        SettingsService::set('drive.oauth_account_email', '', $request->userId());
        return Response::json(['ok' => true]);
    }

    // ── Pomocnicze ──────────────────────────────────────────────────────────

    private function callbackUrl(): string
    {
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        return "https://$host$dir/api/google/drive/callback";
    }

    /** Stan CSRF: bezstanowy podpis HMAC z czasem (ważny 15 min). */
    private function makeState(): string
    {
        $ts = (string) time();
        return $ts . '.' . hash_hmac('sha256', $ts, $this->stateSecret());
    }

    private function verifyState(string $state): bool
    {
        $parts = explode('.', $state);
        if (count($parts) !== 2) {
            return false;
        }
        [$ts, $sig] = $parts;
        if (!ctype_digit($ts) || (time() - (int) $ts) > 900) {
            return false;
        }
        return hash_equals(hash_hmac('sha256', $ts, $this->stateSecret()), $sig);
    }

    private function stateSecret(): string
    {
        return (string) Config::get('JWT_SECRET', 'mmevent-state');
    }

    private function redirect(string $url): Response
    {
        return new Response(['redirect' => $url], 302, ['Location' => $url]);
    }
}
