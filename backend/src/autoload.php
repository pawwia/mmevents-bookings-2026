<?php

/**
 * Autoloader PSR-4 dla App\ → src/.
 * Jeśli istnieje vendor/autoload.php (composer install), używa go;
 * w przeciwnym razie rejestruje własny loader — dzięki temu deploy przez FTP
 * na LH.pl nie wymaga uruchamiania Composera.
 */

declare(strict_types=1);

$composerAutoload = dirname(__DIR__) . '/vendor/autoload.php';

if (is_file($composerAutoload)) {
    require $composerAutoload;
    return;
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
