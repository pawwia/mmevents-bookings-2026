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
    /** Ile sekund pozostało blokady (0 = brak blokady). */
    public static function blockedFor(string $scope, string $identifier): int
    {
        $row = Database::selectOne(
            'SELECT blocked_until FROM rate_limits WHERE scope = ? AND identifier = ?',
            [$scope, $identifier]
        );
        if ($row === null || empty($row['blocked_until'])) {
            return 0;
        }
        return max(0, strtotime($row['blocked_until']) - time());
    }

    /**
     * Rejestruje próbę i zwraca stan.
     * @param int   $max        ile prób dozwolonych zanim nastąpi blokada
     * @param int[] $blockSteps czasy blokad (s) wg numeru naruszenia, np. [1200, 18000]
     * @return array{blocked:bool, retry_after:int, remaining:int}
     */
    public static function register(string $scope, string $identifier, int $max, array $blockSteps): array
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

        // Po wygaśniętej blokadzie licznik prób zaczyna się od nowa (strikes zostają — eskalacja).
        $attempts = ($blockedUntil > 0 ? 0 : (int) $row['attempts']) + 1;
        $strikes = (int) $row['strikes'];

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

        Database::update('rate_limits', ['attempts' => $attempts, 'blocked_until' => null], 'id = ?', [$row['id']]);
        return ['blocked' => false, 'retry_after' => 0, 'remaining' => max(0, $max - $attempts)];
    }

    /** Zeruje limit (np. po udanym logowaniu). */
    public static function clear(string $scope, string $identifier): void
    {
        Database::execute('DELETE FROM rate_limits WHERE scope = ? AND identifier = ?', [$scope, $identifier]);
    }
}
