<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

/**
 * CRM: statystyki roczne/miesięczne — rezerwacje (wpadłe), imprezy, przychód, wpłaty,
 * rozkład imprez po miesiącach (wykres) i miesiąc szczytowy.
 */
class AdminStatsController
{
    public function index(Request $request): Response
    {
        $year = (int) ($request->query['year'] ?? date('Y'));
        $month = isset($request->query['month']) && $request->query['month'] !== ''
            ? max(1, min(12, (int) $request->query['month']))
            : null;

        if ($month !== null) {
            $startDate = sprintf('%04d-%02d-01', $year, $month);
            $endDate = date('Y-m-t', strtotime($startDate));
        } else {
            $startDate = "$year-01-01";
            $endDate = "$year-12-31";
        }
        $startDt = "$startDate 00:00:00";
        $endDt = "$endDate 23:59:59";

        // Podsumowanie wybranego okresu (miesiąc lub cały rok).
        $bookingsIn = (int) (Database::selectOne(
            'SELECT COUNT(*) c FROM bookings WHERE created_at BETWEEN ? AND ?',
            [$startDt, $endDt]
        )['c'] ?? 0);
        $events = (int) (Database::selectOne(
            "SELECT COUNT(*) c FROM bookings WHERE event_date BETWEEN ? AND ? AND status != 'cancelled'",
            [$startDate, $endDate]
        )['c'] ?? 0);
        $revenue = (float) (Database::selectOne(
            "SELECT COALESCE(SUM(total_price), 0) s FROM bookings WHERE event_date BETWEEN ? AND ? AND status != 'cancelled'",
            [$startDate, $endDate]
        )['s'] ?? 0);
        $paid = (float) (Database::selectOne(
            "SELECT COALESCE(SUM(amount), 0) s FROM payments WHERE status = 'paid' AND paid_at BETWEEN ? AND ?",
            [$startDt, $endDt]
        )['s'] ?? 0);

        // Rozkład po miesiącach dla całego roku (do wykresu) — niezależnie od wybranego miesiąca.
        $eventsByMonth = array_fill(1, 12, 0);
        $revByMonth = array_fill(1, 12, 0.0);
        foreach (Database::select(
            "SELECT MONTH(event_date) m, COUNT(*) c, COALESCE(SUM(total_price), 0) s
             FROM bookings WHERE YEAR(event_date) = ? AND status != 'cancelled' GROUP BY MONTH(event_date)",
            [$year]
        ) as $r) {
            $eventsByMonth[(int) $r['m']] = (int) $r['c'];
            $revByMonth[(int) $r['m']] = (float) $r['s'];
        }
        $bookingsByMonth = array_fill(1, 12, 0);
        foreach (Database::select(
            'SELECT MONTH(created_at) m, COUNT(*) c FROM bookings WHERE YEAR(created_at) = ? GROUP BY MONTH(created_at)',
            [$year]
        ) as $r) {
            $bookingsByMonth[(int) $r['m']] = (int) $r['c'];
        }

        $byMonth = [];
        $peakMonth = null;
        $peakEvents = 0;
        for ($m = 1; $m <= 12; $m++) {
            $byMonth[] = [
                'month' => $m,
                'events' => $eventsByMonth[$m],
                'revenue' => round($revByMonth[$m], 2),
                'bookings' => $bookingsByMonth[$m],
            ];
            if ($eventsByMonth[$m] > $peakEvents) {
                $peakEvents = $eventsByMonth[$m];
                $peakMonth = $m;
            }
        }

        $years = array_map(
            static fn ($r) => (int) $r['y'],
            Database::select('SELECT DISTINCT YEAR(event_date) y FROM bookings ORDER BY y DESC')
        );
        if ($years === []) {
            $years = [$year];
        }

        return Response::json([
            'year' => $year,
            'month' => $month,
            'scope' => $month !== null ? 'month' : 'year',
            'bookings_in' => $bookingsIn,
            'events' => $events,
            'revenue' => round($revenue, 2),
            'paid' => round($paid, 2),
            'by_month' => $byMonth,
            'peak_month' => $peakMonth,
            'years' => $years,
        ]);
    }
}
