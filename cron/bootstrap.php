<?php

/**
 * Wspólny bootstrap zadań cron.
 * Każdy cron można uruchomić:
 *   - z CLI:  php cron/send_email_queue.php
 *   - przez HTTP (panel cron LH.pl): https://api.domena.pl/cron/send_email_queue.php?secret=CRON_SECRET
 */

declare(strict_types=1);

use App\Core\App;
use App\Core\Config;

require dirname(__DIR__) . '/backend/src/autoload.php';
App::boot(dirname(__DIR__) . '/backend');

if (PHP_SAPI !== 'cli') {
    $secret = trim((string) Config::get('CRON_SECRET', ''));
    $given = trim((string) ($_GET['secret'] ?? ''));
    if ($secret === '' || !hash_equals($secret, $given)) {
        http_response_code(403);
        $diag = $secret === ''
            ? 'CRON_SECRET w backend/.env jest PUSTY lub brak tej linii (aplikacja nie widzi wartości).'
            : 'CRON_SECRET w .env ma ' . strlen($secret) . ' znaków, a sekret w adresie ma ' . strlen($given)
                . ' znaków — wartości muszą być identyczne.';
        exit('Forbidden — ' . $diag);
    }
    header('Content-Type: text/plain; charset=utf-8');
}

function cron_log(string $message): void
{
    $line = sprintf('[%s] %s', date('Y-m-d H:i:s'), $message);
    echo $line . PHP_EOL;
    error_log($line . PHP_EOL, 3, dirname(__DIR__) . '/backend/storage/logs/cron.log');
}
