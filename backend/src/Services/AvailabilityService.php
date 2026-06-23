<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Analiza dostępności terminu.
 * Uwzględnia: czas imprezy, dojazd (Google Distance Matrix), 1 h rozstawiania, 40 min zwijania.
 * Wynik jest podpowiedzią — kolizyjne rezerwacje zawsze wymagają ręcznego potwierdzenia admina.
 */
final class AvailabilityService
{
    /**
     * Statusy, które realnie blokują termin: dopiero wpłacony zadatek (→ „Rezerwacja potwierdzona")
     * i dalsze etapy. Wstępne zapytania bez zadatku (new / awaiting_contract / awaiting_deposit)
     * NIE blokują dnia — termin pozostaje wolny do czasu potwierdzenia.
     */
    public const BLOCKING_STATUSES = ['confirmed', 'last_call', 'ready', 'completed'];

    /** Zajęte okna w danym dniu (tylko rezerwacje potwierdzone — z zadatkiem). */
    public static function busyWindows(string $date, ?int $excludeBookingId = null): array
    {
        $placeholders = implode(',', array_fill(0, count(self::BLOCKING_STATUSES), '?'));
        $sql = "SELECT id, start_time, duration_hours, venue_address, venue_name, status
                FROM bookings
                WHERE event_date = ? AND status IN ($placeholders)";
        $params = array_merge([$date], self::BLOCKING_STATUSES);
        if ($excludeBookingId !== null) {
            $sql .= ' AND id != ?';
            $params[] = $excludeBookingId;
        }
        $rows = Database::select($sql . ' ORDER BY start_time', $params);
        return array_map(static function (array $row): array {
            $start = substr((string) $row['start_time'], 0, 5);
            $end = self::addMinutes($start, (int) round((float) $row['duration_hours'] * 60));
            return [
                'booking_id' => (int) $row['id'],
                'from' => $start,
                'to' => $end,
                'venue_address' => $row['venue_address'],
                'venue_name' => $row['venue_name'],
                'status' => $row['status'],
            ];
        }, $rows);
    }

    /** Urlop/blokada obejmująca dany dzień (lub null). */
    public static function blackoutFor(string $date): ?array
    {
        return Database::selectOne(
            'SELECT * FROM blackout_dates WHERE ? BETWEEN start_date AND end_date ORDER BY start_date LIMIT 1',
            [$date]
        );
    }

    /**
     * Krok 1 onboardingu: czy data jest wolna; jeśli nie — komunikat z oknem realizacji.
     * Urlop/blokada ma pierwszeństwo — dzień jest niedostępny, z komentarzem od właściciela.
     */
    public static function checkDate(string $date): array
    {
        $blackout = self::blackoutFor($date);
        if ($blackout !== null) {
            return [
                'available' => false,
                'blackout' => true,
                'windows' => [],
                'message' => $blackout['comment'] !== null && trim((string) $blackout['comment']) !== ''
                    ? $blackout['comment']
                    : 'Ten termin jest niedostępny. Prosimy o kontakt z nami.',
            ];
        }
        $windows = self::busyWindows($date);
        if ($windows === []) {
            return ['available' => true, 'windows' => [], 'message' => null];
        }
        $first = $windows[0];
        $last = end($windows);
        return [
            'available' => false,
            'windows' => array_map(fn($w) => ['from' => $w['from'], 'to' => $w['to']], $windows),
            'message' => sprintf(
                'W tym terminie mamy realizację od godziny %s do godziny %s. '
                . 'Jeżeli planowana godzina rozpoczęcia jest inna, możesz złożyć zapytanie. '
                . 'Każdą taką rezerwację potwierdzamy ręcznie.',
                $first['from'],
                $last['to']
            ),
        ];
    }

    /**
     * Czy proponowana realizacja jest logistycznie wykonalna obok już istniejących?
     * Dla każdej pary: koniec wcześniejszej + zwijanie + dojazd + rozstawianie ≤ start późniejszej.
     *
     * @return array{feasible: bool, conflicts: array, details: string[]}
     */
    public static function checkFeasibility(
        string $date,
        string $startTime,
        float $durationHours,
        ?string $venueAddress,
        ?int $excludeBookingId = null,
    ): array {
        $setupMin = SettingsService::int('booking.setup_minutes', 60);
        $teardownMin = SettingsService::int('booking.teardown_minutes', 40);

        $newStart = self::toMinutes($startTime);
        $newEnd = $newStart + (int) round($durationHours * 60);

        $conflicts = [];
        $details = [];
        $feasible = true;

        foreach (self::busyWindows($date, $excludeBookingId) as $window) {
            $existingStart = self::toMinutes($window['from']);
            $existingEnd = self::toMinutes($window['to']);

            // Czas przejazdu między lokalizacjami (jeśli znamy obie i klucz API skonfigurowany)
            $travelMin = 0;
            if ($venueAddress && $window['venue_address']) {
                try {
                    $travelMin = GoogleMapsService::distance($window['venue_address'], $venueAddress)['duration_min'];
                } catch (\Throwable) {
                    $travelMin = 60; // brak danych — bezpieczne założenie
                    $details[] = 'Nie udało się pobrać czasu przejazdu z Google Maps — przyjęto 60 min.';
                }
            }

            if ($newStart >= $existingEnd) {
                // nowa realizacja PO istniejącej
                $earliestPossible = $existingEnd + $teardownMin + $travelMin + $setupMin;
                if ($newStart < $earliestPossible) {
                    $feasible = false;
                    $conflicts[] = $window;
                    $details[] = sprintf(
                        'Po realizacji %s–%s potrzebujemy %d min zwijania + %d min dojazdu + %d min rozstawiania; najwcześniejszy możliwy start: %s.',
                        $window['from'], $window['to'], $teardownMin, $travelMin, $setupMin,
                        self::fromMinutes($earliestPossible)
                    );
                }
            } elseif ($newEnd <= $existingStart) {
                // nowa realizacja PRZED istniejącą
                $latestPossibleEnd = $existingStart - $setupMin - $travelMin - $teardownMin;
                if ($newEnd > $latestPossibleEnd) {
                    $feasible = false;
                    $conflicts[] = $window;
                    $details[] = sprintf(
                        'Przed realizacją %s–%s musimy zwinąć (%d min), dojechać (%d min) i rozstawić (%d min); Twoja impreza musiałaby zakończyć się do %s.',
                        $window['from'], $window['to'], $teardownMin, $travelMin, $setupMin,
                        self::fromMinutes(max(0, $latestPossibleEnd))
                    );
                }
            } else {
                // nakładanie się godzin
                $feasible = false;
                $conflicts[] = $window;
                $details[] = sprintf('Godziny nakładają się z realizacją %s–%s.', $window['from'], $window['to']);
            }
        }

        return ['feasible' => $feasible, 'conflicts' => $conflicts, 'details' => $details];
    }

    private static function toMinutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', substr($time, 0, 5)));
        return $h * 60 + $m;
    }

    private static function fromMinutes(int $minutes): string
    {
        return sprintf('%02d:%02d', intdiv($minutes, 60) % 24, $minutes % 60);
    }

    private static function addMinutes(string $time, int $minutes): string
    {
        return self::fromMinutes(self::toMinutes($time) + $minutes);
    }
}
