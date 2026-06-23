<?php

declare(strict_types=1);

namespace App\Core;

use Throwable;

final class App
{
    private static string $basePath;

    public static function boot(string $basePath): void
    {
        self::$basePath = $basePath;
        Config::load($basePath);
        date_default_timezone_set('Europe/Warsaw');
        mb_internal_encoding('UTF-8');

        error_reporting(E_ALL);
        ini_set('display_errors', Config::bool('APP_DEBUG') ? '1' : '0');
        ini_set('log_errors', '1');
        ini_set('error_log', $basePath . '/storage/logs/php-error.log');
    }

    public static function basePath(): string
    {
        return self::$basePath;
    }

    public static function run(Router $router): void
    {
        $request = Request::capture();
        self::sendCorsHeaders();
        self::sendSecurityHeaders();

        if ($request->method === 'OPTIONS') {
            http_response_code(204);
            return;
        }

        try {
            $router->dispatch($request)->send();
        } catch (Throwable $e) {
            error_log(sprintf('[%s] %s in %s:%d', $e::class, $e->getMessage(), $e->getFile(), $e->getLine()));
            $message = Config::bool('APP_DEBUG') ? $e->getMessage() : 'Wystąpił błąd serwera';
            Response::error($message, 500)->send();
        }
    }

    /** Nagłówki bezpieczeństwa dla wszystkich odpowiedzi API. */
    private static function sendSecurityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Cross-Origin-Resource-Policy: same-site');
    }

    private static function sendCorsHeaders(): void
    {
        $allowed = Config::get('FRONTEND_URL', '*');
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        // Dopuszczamy adres z .env oraz localhost (development lokalnego frontendu).
        $isLocalhost = (bool) preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);
        $allowOrigin = match (true) {
            $origin !== '' && ($origin === $allowed || $isLocalhost) => $origin,
            $allowed !== '*' => $allowed,
            default => '*',
        };
        header('Access-Control-Allow-Origin: ' . $allowOrigin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Max-Age: 86400');
    }
}
