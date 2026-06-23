<?php

/**
 * Czyszczenie osieroconych plików w public/uploads — czyli takich, do których nie odwołuje się
 * już żaden rekord w bazie (np. po usunięciu szablonów wydruków, teł, wzorów ksiąg).
 *
 *   php bin/cleanup_uploads.php           — tylko pokazuje, co zostałoby usunięte (dry-run)
 *   php bin/cleanup_uploads.php --delete  — faktycznie usuwa osierocone pliki
 *
 * NIE usuwa plików nadal używanych przez katalogi (animacje/tła/szablony/księgi) ani logo/favicon.
 */

declare(strict_types=1);

use App\Core\App;
use App\Core\Database;

require __DIR__ . '/../src/autoload.php';
App::boot(dirname(__DIR__));

$delete = in_array('--delete', $argv ?? [], true);
$uploadsDir = App::basePath() . '/public/uploads';

if (!is_dir($uploadsDir)) {
    echo "Katalog $uploadsDir nie istnieje — nic do czyszczenia.\n";
    exit;
}

// 1. Zbierz wszystkie URL-e/ścieżki nadal używane w bazie.
$referenced = [];
$addRef = static function (?string $url) use (&$referenced): void {
    if ($url === null || $url === '') {
        return;
    }
    $pos = strpos($url, '/uploads/');
    if ($pos !== false) {
        $referenced[substr($url, $pos)] = true; // klucz: /uploads/RRRR/MM/plik
    }
};

foreach (Database::select('SELECT image_url FROM print_templates') as $r) {
    $addRef($r['image_url']);
}
foreach (Database::select('SELECT image_url FROM backgrounds') as $r) {
    $addRef($r['image_url']);
}
foreach (Database::select('SELECT image_url FROM guestbook_designs') as $r) {
    $addRef($r['image_url']);
}
foreach (Database::select('SELECT thumbnail_url FROM animations') as $r) {
    $addRef($r['thumbnail_url']);
}
// Ustawienia: logo, favicon i inne pola graficzne.
foreach (Database::select("SELECT `value` FROM settings WHERE `key` LIKE '%logo_url' OR `key` LIKE '%favicon_url' OR `key` LIKE '%_image'") as $r) {
    $addRef($r['value']);
}

// 2. Przejdź po plikach i znajdź osierocone.
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploadsDir, FilesystemIterator::SKIP_DOTS));
$orphans = [];
$bytes = 0;
foreach ($iterator as $file) {
    if (!$file->isFile()) {
        continue;
    }
    $rel = '/uploads' . substr($file->getPathname(), strlen($uploadsDir)); // /uploads/RRRR/MM/plik
    $rel = str_replace('\\', '/', $rel);
    if (!isset($referenced[$rel])) {
        $orphans[] = $file->getPathname();
        $bytes += $file->getSize();
    }
}

echo 'Plików w uploads: ' . iterator_count(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploadsDir, FilesystemIterator::SKIP_DOTS))) . "\n";
echo 'Używanych (w bazie): ' . count($referenced) . "\n";
echo 'Osieroconych: ' . count($orphans) . ' (' . round($bytes / 1048576, 2) . " MB)\n\n";

foreach ($orphans as $path) {
    if ($delete) {
        @unlink($path);
        echo "USUNIĘTO: $path\n";
    } else {
        echo "do usunięcia: $path\n";
    }
}

echo $delete
    ? "\nGotowe — usunięto " . count($orphans) . " plików.\n"
    : "\nTo był podgląd (dry-run). Uruchom z --delete, aby usunąć.\n";
