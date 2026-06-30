<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Dziennik aktywności serwisu — zapisuje zdarzenia (logowania, resety hasła, blokady,
 * zmiany personalizacji…), żeby admin w CRM widział, co się dzieje przy zgłoszeniach klientów.
 *
 * Logowanie NIGDY nie może wywrócić właściwej akcji — wszystko w try/catch (fail-open).
 */
final class ActivityLog
{
    public static function record(string $event, array $data = []): void
    {
        try {
            Database::insert('activity_log', [
                'event' => $event,
                'user_id' => $data['user_id'] ?? null,
                'email' => isset($data['email']) ? mb_substr((string) $data['email'], 0, 255) : null,
                'ip' => $data['ip'] ?? null,
                'booking_id' => $data['booking_id'] ?? null,
                'detail' => isset($data['detail']) ? mb_substr((string) $data['detail'], 0, 255) : null,
            ]);
        } catch (\Throwable $e) {
            error_log('ActivityLog: ' . $e->getMessage());
        }
    }
}
