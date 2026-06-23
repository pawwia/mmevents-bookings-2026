<?php

declare(strict_types=1);

namespace App\Core;

/** Konfiguracja środowiska (.env) — sekrety infrastrukturalne; reszta konfiguracji żyje w tabeli settings. */
final class Config
{
    private static array $env = [];

    public static function load(string $basePath): void
    {
        $file = $basePath . '/.env';
        if (is_file($file)) {
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                    continue;
                }
                [$key, $value] = explode('=', $line, 2);
                self::$env[trim($key)] = trim(trim($value), "\"'");
            }
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::$env[$key] ?? (getenv($key) !== false ? getenv($key) : $default);
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $v = self::get($key);
        return $v === null ? $default : in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
    }
}
