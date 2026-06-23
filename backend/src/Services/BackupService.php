<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Kopia zapasowa bazy danych generowana w PHP (bez mysqldump — działa na hostingu współdzielonym).
 * Zwraca pełny zrzut SQL (struktura + dane) gotowy do przywrócenia.
 */
final class BackupService
{
    /** Generuje zrzut SQL całej bazy. */
    public static function dumpSql(): string
    {
        $pdo = Database::pdo();
        $out = "-- Kopia zapasowa mmevents.pl — " . date('Y-m-d H:i:s') . "\n"
            . "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n";

        foreach (self::tables() as $table) {
            $create = Database::selectOne("SHOW CREATE TABLE `$table`");
            $createSql = $create['Create Table'] ?? array_values($create ?? [])[1] ?? '';
            $out .= "DROP TABLE IF EXISTS `$table`;\n$createSql;\n\n";

            $rows = Database::select("SELECT * FROM `$table`");
            foreach ($rows as $row) {
                $cols = implode(', ', array_map(static fn ($c) => "`$c`", array_keys($row)));
                $vals = implode(', ', array_map(
                    static fn ($v) => $v === null ? 'NULL' : $pdo->quote((string) $v),
                    array_values($row)
                ));
                $out .= "INSERT INTO `$table` ($cols) VALUES ($vals);\n";
            }
            $out .= "\n";
        }

        $out .= "SET FOREIGN_KEY_CHECKS = 1;\n";
        return $out;
    }

    public static function filename(): string
    {
        return 'mmevents-backup-' . date('Y-m-d_His') . '.sql';
    }

    /** Lista tabel w bieżącej bazie (nazwy pochodzą z silnika DB — bezpieczne w SQL). */
    private static function tables(): array
    {
        return array_map(static fn (array $r) => (string) array_values($r)[0], Database::select('SHOW TABLES'));
    }
}
