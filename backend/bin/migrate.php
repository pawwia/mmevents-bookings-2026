<?php

/**
 * Uruchamia migracje (idempotentnie) i opcjonalnie seedery.
 *   php bin/migrate.php          — same migracje
 *   php bin/migrate.php --seed   — migracje + seedery (świeża baza)
 */

declare(strict_types=1);

use App\Core\App;
use App\Core\Database;

require __DIR__ . '/../src/autoload.php';
App::boot(dirname(__DIR__));

$pdo = Database::pdo();
$migrationsDir = dirname(__DIR__, 2) . '/database/migrations';
$seedsDir = dirname(__DIR__, 2) . '/database/seeds';

$pdo->exec('CREATE TABLE IF NOT EXISTS migrations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

$executed = array_column(Database::select('SELECT filename FROM migrations'), 'filename');

foreach (glob("$migrationsDir/*.sql") as $file) {
    $name = basename($file);
    if (in_array($name, $executed, true)) {
        echo "= $name (pominięto)\n";
        continue;
    }
    echo "> $name\n";
    $pdo->exec(file_get_contents($file));
    Database::insert('migrations', ['filename' => $name]);
}

if (in_array('--seed', $argv ?? [], true)) {
    foreach (glob("$seedsDir/*.sql") as $file) {
        $name = 'seed:' . basename($file);
        if (in_array($name, $executed, true)) {
            echo "= $name (pominięto)\n";
            continue;
        }
        echo "> $name\n";
        $pdo->exec(file_get_contents($file));
        Database::insert('migrations', ['filename' => $name]);
    }
}

echo "Gotowe.\n";
