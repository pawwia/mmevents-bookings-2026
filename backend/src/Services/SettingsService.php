<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/** Ustawienia systemowe z bazy + audyt każdej zmiany (kto / kiedy / stara / nowa wartość). */
final class SettingsService
{
    private static ?array $cache = null;

    public static function get(string $key, ?string $default = null): ?string
    {
        self::warm();
        return self::$cache[$key]['value'] ?? $default;
    }

    public static function int(string $key, int $default = 0): int
    {
        $v = self::get($key);
        return $v === null || $v === '' ? $default : (int) $v;
    }

    public static function float(string $key, float $default = 0.0): float
    {
        $v = self::get($key);
        return $v === null || $v === '' ? $default : (float) str_replace(',', '.', $v);
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $v = self::get($key);
        return $v === null || $v === '' ? $default : in_array(strtolower($v), ['1', 'true', 'yes'], true);
    }

    /** Wszystkie ustawienia pogrupowane; sekrety maskowane do podglądu w CRM. */
    public static function allGrouped(bool $maskSecrets = true): array
    {
        self::warm();
        $grouped = [];
        foreach (self::$cache as $row) {
            $value = $row['value'];
            if ($maskSecrets && $row['type'] === 'secret' && $value !== null && $value !== '') {
                $value = '••••••' . substr($value, -4);
            }
            $grouped[$row['group']][] = [
                'key' => $row['key'],
                'value' => $value,
                'type' => $row['type'],
                'label' => $row['label'],
                'is_set' => $row['value'] !== null && $row['value'] !== '',
            ];
        }
        return $grouped;
    }

    /** Ustawienia publiczne (kolory, logo, nazwa firmy) — bez logowania. */
    public static function publicSettings(): array
    {
        self::warm();
        $out = [];
        foreach (self::$cache as $row) {
            if ((int) $row['is_public'] === 1 && $row['type'] !== 'secret') {
                $out[$row['key']] = $row['value'];
            }
        }
        return $out;
    }

    /** Zapis z audytem. Wartość '__UNCHANGED__' dla sekretu = nie nadpisuj (maska z formularza). */
    public static function set(string $key, ?string $value, ?int $changedBy): bool
    {
        $current = Database::selectOne('SELECT `value`, type FROM settings WHERE `key` = ?', [$key]);
        if ($current === null) {
            return false;
        }
        // Sekret: puste pole lub odesłana maska = „bez zmian" (nie nadpisujemy zapisanej wartości).
        if ($current['type'] === 'secret' && ($value === null || trim($value) === '' || str_starts_with($value, '••••'))) {
            return true;
        }
        if ($current['value'] === $value) {
            return true;
        }
        Database::update('settings', ['value' => $value], '`key` = ?', [$key]);
        Database::insert('settings_audit', [
            'setting_key' => $key,
            'old_value' => $current['type'] === 'secret' ? '[ukryte]' : $current['value'],
            'new_value' => $current['type'] === 'secret' ? '[ukryte]' : $value,
            'changed_by' => $changedBy,
        ]);
        self::$cache = null;
        return true;
    }

    private static function warm(): void
    {
        if (self::$cache === null) {
            self::$cache = [];
            foreach (Database::select('SELECT `group`, `key`, `value`, type, label, is_public FROM settings ORDER BY `group`, sort_order') as $row) {
                self::$cache[$row['key']] = $row;
            }
        }
    }
}
