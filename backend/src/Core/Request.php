<?php

declare(strict_types=1);

namespace App\Core;

final class Request
{
    public ?array $user = null; // ustawiane przez AuthMiddleware
    public array $params = [];  // parametry ścieżki {id}

    private array $body;

    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
        public readonly string $rawBody,
    ) {
        // JSON (application/json) albo dane formularza/multipart (PHP parsuje je do $_POST,
        // a php://input jest wtedy puste — np. upload pliku z dodatkowymi polami).
        $decoded = json_decode($rawBody, true);
        $this->body = is_array($decoded) ? $decoded : ($_POST ?: []);
    }

    public static function capture(): self
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // Aplikacja może działać w podkatalogu (np. /backend/public na LH.pl) —
        // odcinamy prefiks katalogu front controllera, by trasy zaczynały się od /api.
        $basePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        if ($basePath !== '' && str_starts_with($uri, $basePath)) {
            $uri = substr($uri, strlen($basePath)) ?: '/';
        }
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value;
            }
        }
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers['authorization'] = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headers['authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            rtrim($uri, '/') ?: '/',
            $_GET,
            $headers,
            file_get_contents('php://input') ?: ''
        );
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->body;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function bearerToken(): ?string
    {
        $auth = $this->header('authorization') ?? '';
        return preg_match('/^Bearer\s+(.+)$/i', $auth, $m) ? $m[1] : null;
    }

    public function isAdmin(): bool
    {
        return ($this->user['role'] ?? null) === 'admin';
    }

    public function userId(): int
    {
        return (int) ($this->user['id'] ?? 0);
    }
}
