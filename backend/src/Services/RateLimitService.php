<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Limity prób (anty-nadużycia) per (scope, identyfikator — zwykle IP).
 * Po przekroczeniu progu nakłada blokadę o czasie zależnym od numeru naruszenia (eskalacja).
 * Po wygaśnięciu blokady licznik prób startuje od nowa; liczba naruszeń (strikes) narasta.
 */
final class RateLimitService
{
    /** Ile sekund pozostało blokady (0 = brak blokady). Fail-open przy błędzie infrastruktury. */
    public static function blockedFor(string $scope, string $identifier): int
    {
        try {
            $row = Database::selectOne(
                'SELECT blocked_until FROM rate_limits WHERE scope = ? AND identifier = ?',
                [$scope, $identifier]
            );
            if ($row === null || empty($row['blocked_until'])) {
                return 0;
            }
            return max(0, strtotime($row['blocked_until']) - time());
        } catch (\Throwable $e) {
            error_log('RateLimit blockedFor: ' . $e->getMessage());
            return 0; // nie blokujemy z powodu problemu z tabelą limitów
        }
    }

    /**
     * Rejestruje próbę i zwraca stan.
     * @param int   $max             ile prób dozwolonych zanim nastąpi blokada
     * @param int[] $blockSteps      czasy blokad (s) wg numeru naruszenia, np. [1200, 18000]
     * @param int   $idleResetSeconds po tylu sekundach bezczynności licznik i eskalacja są zerowane
     *                               (domyślnie 24 h) — limit jest „kroczący", nie dożywotni
     * @return array{blocked:bool, retry_after:int, remaining:int}
     */
    public static function register(string $scope, string $identifier, int $max, array $blockSteps, int $idleResetSeconds = 86400): array
    {
        try {
            return self::registerInner($scope, $identifier, $max, $blockSteps, $idleResetSeconds);
        } catch (\Throwable $e) {
            error_log('RateLimit register: ' . $e->getMessage());
            return ['blocked' => false, 'retry_after' => 0, 'remaining' => 0]; // fail-open
        }
    }

    private static function registerInner(string $scope, string $identifier, int $max, array $blockSteps, int $idleResetSeconds): array
    {
        $now = time();
        $row = Database::selectOne(
            'SELECT * FROM rate_limits WHERE scope = ? AND identifier = ?',
            [$scope, $identifier]
        );

        if ($row === null) {
            Database::insert('rate_limits', [
                'scope' => $scope,
                'identifier' => $identifier,
                'attempts' => 1,
                'strikes' => 0,
                'window_started_at' => date('Y-m-d H:i:s', $now),
            ]);
            return ['blocked' => false, 'retry_after' => 0, 'remaining' => max(0, $max - 1)];
        }

        $blockedUntil = $row['blocked_until'] ? strtotime($row['blocked_until']) : 0;
        if ($blockedUntil > $now) {
            return ['blocked' => true, 'retry_after' => $blockedUntil - $now, 'remaining' => 0];
        }

        // Czas ostatniej aktywności (updated_at zmienia się przy każdym zapisie).
        $lastActive = strtotime((string) ($row['updated_at'] ?? $row['window_started_at'] ?? 'now'));
        $idle = ($now - $lastActive) >= $idleResetSeconds;

        if ($idle) {
            // Długa przerwa (np. powrót po tygodniu) → pełny reset: licznik i eskalacja od zera.
            $attempts = 1;
            $strikes = 0;
        } elseif ($blockedUntil > 0) {
            // Tuż po wygaśnięciu blokady — nowa pula prób; eskalacja (strikes) zostaje.
            $attempts = 1;
            $strikes = (int) $row['strikes'];
        } else {
            $attempts = (int) $row['attempts'] + 1;
            $strikes = (int) $row['strikes'];
        }

        if ($attempts > $max) {
            $strikes++;
            $step = $blockSteps[min($strikes - 1, count($blockSteps) - 1)];
            Database::update('rate_limits', [
                'attempts' => $attempts,
                'strikes' => $strikes,
                'blocked_until' => date('Y-m-d H:i:s', $now + $step),
                'window_started_at' => date('Y-m-d H:i:s', $now),
            ], 'id = ?', [$row['id']]);
            return ['blocked' => true, 'retry_after' => $step, 'remaining' => 0];
        }

        Database::update('rate_limits', [
            'attempts' => $attempts,
            'strikes' => $strikes,
            'blocked_until' => null,
            'window_started_at' => date('Y-m-d H:i:s', $now),
        ], 'id = ?', [$row['id']]);
        return ['blocked' => false, 'retry_after' => 0, 'remaining' => max(0, $max - $attempts)];
    }

    /** Zeruje limit (np. po udanym logowaniu). */
    public static function clear(string $scope, string $identifier): void
    {
        Database::execute('DELETE FROM rate_limits WHERE scope = ? AND identifier = ?', [$scope, $identifier]);
    }
}
