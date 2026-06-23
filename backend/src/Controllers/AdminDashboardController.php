<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\BookingService;

/** CRM: dashboard — statystyki, nadchodzące realizacje, zadania wymagające uwagi. */
class AdminDashboardController
{
    public function index(Request $request): Response
    {
        $statusCounts = [];
        foreach (Database::select('SELECT status, COUNT(*) AS cnt FROM bookings GROUP BY status') as $row) {
            $statusCounts[$row['status']] = (int) $row['cnt'];
        }

        $monthStart = date('Y-m-01');
        $revenue = Database::selectOne(
            "SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings
             WHERE event_date >= ? AND status NOT IN ('cancelled', 'new')",
            [$monthStart]
        );

        $upcoming = Database::select(
            "SELECT b.id, b.event_date, b.start_time, b.status, b.venue_name, b.venue_address,
                    p.name AS package_name, u.first_name, u.last_name, u.phone
             FROM bookings b
             JOIN users u ON u.id = b.user_id
             JOIN packages p ON p.id = b.package_id
             WHERE b.event_date >= CURDATE() AND b.status NOT IN ('cancelled')
             ORDER BY b.event_date, b.start_time LIMIT 10"
        );
        foreach ($upcoming as &$booking) {
            $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        }

        $attention = Database::select(
            "SELECT b.id, b.event_date, b.status, b.requires_manual_confirmation,
                    u.first_name, u.last_name
             FROM bookings b JOIN users u ON u.id = b.user_id
             WHERE b.status IN ('new', 'awaiting_contract', 'awaiting_deposit')
             ORDER BY b.created_at DESC LIMIT 10"
        );
        foreach ($attention as &$booking) {
            $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        }

        $queues = [
            'email_pending' => (int) (Database::selectOne("SELECT COUNT(*) c FROM email_queue WHERE status='pending'")['c'] ?? 0),
            'email_failed' => (int) (Database::selectOne("SELECT COUNT(*) c FROM email_queue WHERE status='failed'")['c'] ?? 0),
            'sms_pending' => (int) (Database::selectOne("SELECT COUNT(*) c FROM sms_queue WHERE status='pending'")['c'] ?? 0),
            'sms_failed' => (int) (Database::selectOne("SELECT COUNT(*) c FROM sms_queue WHERE status='failed'")['c'] ?? 0),
        ];

        return Response::json([
            'status_counts' => $statusCounts,
            'statuses' => BookingService::STATUSES,
            'month_revenue' => (float) $revenue['total'],
            'upcoming' => $upcoming,
            'attention' => $attention,
            'queues' => $queues,
        ]);
    }

    /** Lista klientów z liczbą rezerwacji. */
    public function clients(Request $request): Response
    {
        $where = "u.role = 'client'";
        $params = [];
        if (!empty($request->query['q'])) {
            $where .= ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR cp.company_name LIKE ?)';
            $like = '%' . $request->query['q'] . '%';
            array_push($params, $like, $like, $like, $like);
        }
        return Response::json(Database::select(
            "SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.created_at,
                    cp.type, cp.company_name, cp.city, cp.notes,
                    COUNT(b.id) AS bookings_count
             FROM users u
             LEFT JOIN client_profiles cp ON cp.user_id = u.id
             LEFT JOIN bookings b ON b.user_id = u.id
             WHERE $where
             GROUP BY u.id, cp.id
             ORDER BY u.created_at DESC LIMIT 200",
            $params
        ));
    }
}
