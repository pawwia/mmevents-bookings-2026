<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\CloudflareService;
use App\Services\GoogleAuthService;
use App\Services\JwtService;
use App\Services\MailerService;
use App\Services\RateLimitService;
use App\Services\SettingsService;

class AuthController
{
    /** Generuje token weryfikacyjny i kolejkuje e-mail aktywacyjny. */
    private static function sendVerificationEmail(array $user): void
    {
        $token = bin2hex(random_bytes(32));
        Database::update('users', ['verification_token' => $token], 'id = ?', [$user['id']]);
        $link = rtrim((string) SettingsService::get('app.frontend_url', ''), '/') . '/weryfikacja/' . $token;
        MailerService::queueEmail('email_verification', $user['email'], $user['first_name'] ?? null, [
            'imie' => $user['first_name'] ?: 'Kliencie',
            'link_weryfikacji' => $link,
            'stopka' => nl2br((string) SettingsService::get('company.email_footer', '')),
        ]);
    }
    public function register(Request $request): Response
    {
        // Dane osobowe są opcjonalne — w kreatorze rezerwacji konto powstaje na podstawie
        // samego e-maila i hasła, a dane do faktury/umowy klient uzupełnia w kolejnym kroku.
        $v = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|password',
            'first_name' => 'max:100',
            'last_name' => 'max:100',
            'phone' => 'phone',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane', 422, $v->errors());
        }
        if (Database::selectOne('SELECT id FROM users WHERE email = ?', [$request->input('email')])) {
            return Response::error('Konto z tym adresem e-mail już istnieje', 409);
        }
        $userId = Database::insert('users', [
            'email' => strtolower(trim((string) $request->input('email'))),
            'password_hash' => password_hash((string) $request->input('password'), PASSWORD_BCRYPT),
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'phone' => $request->input('phone'),
        ]);
        Database::insert('client_profiles', ['user_id' => $userId]);
        $user = Database::selectOne('SELECT * FROM users WHERE id = ?', [$userId]);
        self::sendVerificationEmail($user); // e-mail aktywacyjny
        return Response::json(['token' => JwtService::issue($user), 'user' => self::publicUser($user)], 201);
    }

    public function login(Request $request): Response
    {
        $ip = BookingController::clientIp();
        $wait = RateLimitService::blockedFor('login', $ip);
        if ($wait > 0) {
            return Response::error('Zbyt wiele prób logowania. Spróbuj ponownie za ' . self::humanWait($wait) . '.', 429);
        }
        if (!CloudflareService::verify($request->input('cf_token'), $ip)) {
            return Response::error('Potwierdź, że nie jesteś robotem (Cloudflare).', 403);
        }
        $user = Database::selectOne('SELECT * FROM users WHERE email = ?', [strtolower(trim((string) $request->input('email')))]);
        if ($user === null || !$user['password_hash']
            || !password_verify((string) $request->input('password'), $user['password_hash'])) {
            // Licznik tylko dla nieudanych prób; po 10 → blokada 15 min, kolejne → 1 h.
            RateLimitService::register('login', $ip, 10, [900, 3600]);
            return Response::error('Nieprawidłowy e-mail lub hasło', 401);
        }
        if (!(int) $user['is_active']) {
            return Response::error('Konto jest nieaktywne', 403);
        }
        RateLimitService::clear('login', $ip); // udane logowanie zeruje licznik
        return Response::json(['token' => JwtService::issue($user), 'user' => self::publicUser($user)]);
    }

    /** Czytelny czas oczekiwania dla komunikatów blokady. */
    private static function humanWait(int $seconds): string
    {
        return $seconds >= 3600
            ? (int) ceil($seconds / 3600) . ' godz.'
            : max(1, (int) ceil($seconds / 60)) . ' min';
    }

    /** Logowanie przez Google — frontend przekazuje ID token (credential). */
    public function googleLogin(Request $request): Response
    {
        $idToken = (string) $request->input('credential', '');
        $profile = $idToken !== '' ? GoogleAuthService::verifyIdToken($idToken) : null;
        if ($profile === null) {
            return Response::error('Weryfikacja Google nie powiodła się', 401);
        }
        $user = Database::selectOne('SELECT * FROM users WHERE google_id = ? OR email = ?', [$profile['google_id'], $profile['email']]);
        if ($user === null) {
            $userId = Database::insert('users', [
                'email' => $profile['email'],
                'google_id' => $profile['google_id'],
                'first_name' => $profile['first_name'],
                'last_name' => $profile['last_name'],
                'email_verified_at' => date('Y-m-d H:i:s'), // Google potwierdza adres e-mail
            ]);
            Database::insert('client_profiles', ['user_id' => $userId]);
            $user = Database::selectOne('SELECT * FROM users WHERE id = ?', [$userId]);
        } elseif (!$user['google_id']) {
            Database::update('users', ['google_id' => $profile['google_id']], 'id = ?', [$user['id']]);
        }
        if (!(int) $user['is_active']) {
            return Response::error('Konto jest nieaktywne', 403);
        }
        return Response::json(['token' => JwtService::issue($user), 'user' => self::publicUser($user)]);
    }

    /**
     * Sprawdza, czy e-mail ma już konto — kreator rezerwacji decyduje, czy poprosić
     * o hasło do logowania (konto istnieje), czy o ustawienie nowego hasła (rejestracja).
     */
    public function checkEmail(Request $request): Response
    {
        $email = strtolower(trim((string) $request->input('email', '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return Response::error('Nieprawidłowy adres e-mail', 422);
        }
        $user = Database::selectOne('SELECT password_hash, google_id FROM users WHERE email = ?', [$email]);
        return Response::json([
            'exists' => $user !== null,
            // Konto założone wyłącznie przez Google nie ma hasła — proponujemy logowanie Google.
            'google_only' => $user !== null && empty($user['password_hash']) && !empty($user['google_id']),
        ]);
    }

    /** Aktywacja konta po kliknięciu w link z e-maila (publiczne). */
    public function verifyEmail(Request $request): Response
    {
        $token = trim((string) $request->input('token', ''));
        if ($token === '') {
            return Response::error('Brak tokenu weryfikacyjnego', 422);
        }
        $user = Database::selectOne('SELECT id, email_verified_at FROM users WHERE verification_token = ?', [$token]);
        if ($user === null) {
            return Response::error('Link weryfikacyjny jest nieprawidłowy lub został już użyty', 422);
        }
        // Idempotentnie: NIE kasujemy tokenu, więc ponowne kliknięcie (lub podwójne wywołanie
        // w trybie deweloperskim / skaner poczty) także zakończy się sukcesem.
        if (empty($user['email_verified_at'])) {
            Database::update('users', ['email_verified_at' => date('Y-m-d H:i:s')], 'id = ?', [$user['id']]);
        }
        return Response::json(['ok' => true]);
    }

    /** Ponowna wysyłka linku aktywacyjnego (zalogowany klient). */
    public function resendVerification(Request $request): Response
    {
        $user = Database::selectOne('SELECT * FROM users WHERE id = ?', [$request->userId()]);
        if ($user === null) {
            return Response::error('Konto nie istnieje', 404);
        }
        if (!empty($user['email_verified_at'])) {
            return Response::json(['ok' => true, 'already_verified' => true]);
        }
        self::sendVerificationEmail($user);
        return Response::json(['ok' => true]);
    }

    public function me(Request $request): Response
    {
        $profile = Database::selectOne('SELECT * FROM client_profiles WHERE user_id = ?', [$request->userId()]);
        return Response::json(['user' => self::publicUser($request->user), 'profile' => $profile]);
    }

    public function updateProfile(Request $request): Response
    {
        $v = Validator::make($request->all(), [
            'first_name' => 'max:100', 'last_name' => 'max:100', 'phone' => 'phone',
            'postal_code' => 'postal_code', 'nip' => 'nip',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane', 422, $v->errors());
        }
        $userFields = array_intersect_key($request->all(), array_flip(['first_name', 'last_name', 'phone']));
        if ($userFields) {
            Database::update('users', $userFields, 'id = ?', [$request->userId()]);
        }
        $profileFields = array_intersect_key($request->all(), array_flip([
            'type', 'street', 'house_no', 'apartment_no', 'postal_code', 'city', 'country',
            'company_name', 'nip', 'company_address', 'representative', 'notes',
        ]));
        if ($profileFields) {
            Database::update('client_profiles', $profileFields, 'user_id = ?', [$request->userId()]);
        }
        return $this->me($request);
    }

    public function changePassword(Request $request): Response
    {
        $v = Validator::make($request->all(), ['password' => 'required|min:8']);
        if ($v->fails()) {
            return Response::error('Hasło musi mieć min. 8 znaków', 422, $v->errors());
        }
        $user = Database::selectOne('SELECT password_hash FROM users WHERE id = ?', [$request->userId()]);
        if ($user['password_hash'] !== null
            && !password_verify((string) $request->input('current_password', ''), $user['password_hash'])) {
            return Response::error('Aktualne hasło jest nieprawidłowe', 401);
        }
        Database::update('users', [
            'password_hash' => password_hash((string) $request->input('password'), PASSWORD_BCRYPT),
        ], 'id = ?', [$request->userId()]);
        return Response::json(['ok' => true]);
    }

    private static function publicUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'phone' => $user['phone'],
            'email_verified' => !empty($user['email_verified_at']),
        ];
    }
}
