<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

/**
 * CRM → Sprawdzenia terminów: kto i kiedy sprawdzał dostępność dat.
 * Próbuje dopasować e-mail klienta po IP (zalogowany użytkownik lub rezerwacja z tego samego IP).
 */
class AdminAvailabilityController
{
    /** Lista sprawdzeń (filtry: ?ip=&from=&to=&q=). */
    public function index(Request $request): Response
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($request->query['ip'])) {
            $where[] = 'ac.ip = ?';
            $params[] = $request->query['ip'];
        }
        if (!empty($request->query['from'])) {
            $where[] = 'ac.created_at >= ?';
            $params[] = $request->query['from'] . ' 00:00:00';
        }
        if (!empty($request->query['to'])) {
            $where[] = 'ac.created_at <= ?';
            $params[] = $request->query['to'] . ' 23:59:59';
        }

        // E-mail dopasowany: 1) zalogowany użytkownik, 2) najnowsza rezerwacja z tego samego IP
        $rows = Database::select(
            'SELECT ac.id, ac.check_date, ac.ip, ac.available, ac.created_at,
                    u.email AS user_email, u.first_name, u.last_name,
                    (SELECT CONCAT(u2.email)
                       FROM bookings b JOIN users u2 ON u2.id = b.user_id
                       WHERE b.created_ip = ac.ip ORDER BY b.id DESC LIMIT 1) AS matched_email
             FROM availability_checks ac
             LEFT JOIN users u ON u.id = ac.user_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY ac.id DESC LIMIT 500',
            $params
        );
        foreach ($rows as &$row) {
            $row['email'] = $row['user_email'] ?: $row['matched_email'] ?: null;
            $row['client'] = $row['first_name'] ? trim($row['first_name'] . ' ' . $row['last_name']) : null;
            unset($row['user_email'], $row['matched_email'], $row['first_name'], $row['last_name']);
        }
        return Response::json($rows);
    }

    /** Ranking adresów IP wg liczby sprawdzeń (kto sprawdzał najwięcej). */
    public function topIps(Request $request): Response
    {
        return Response::json(Database::select(
            "SELECT ac.ip,
                    COUNT(*) AS checks,
                    COUNT(DISTINCT ac.check_date) AS distinct_dates,
                    MAX(ac.created_at) AS last_check,
                    (SELECT u.email FROM bookings b JOIN users u ON u.id = b.user_id
                       WHERE b.created_ip = ac.ip ORDER BY b.id DESC LIMIT 1) AS matched_email
             FROM availability_checks ac
             WHERE ac.ip IS NOT NULL
             GROUP BY ac.ip
             ORDER BY checks DESC
             LIMIT 100"
        ));
    }
}
