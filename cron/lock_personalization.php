<?php

/**
 * Blokada personalizacji N dni przed imprezą (domyślnie 3)
 * + zmiana statusu na "Gotowe do realizacji".
 * Zalecane: raz dziennie.
 */

declare(strict_types=1);

use App\Core\Database;
use App\Services\BookingService;
use App\Services\SettingsService;

require __DIR__ . '/bootstrap.php';

$days = SettingsService::int('booking.personalization_lock_days', 3);
$cutoffDate = date('Y-m-d', strtotime("+$days days"));

$bookings = Database::select(
    "SELECT id, status FROM bookings
     WHERE event_date <= ?
       AND personalization_locked_at IS NULL
       AND status IN ('confirmed', 'last_call')",
    [$cutoffDate]
);
cron_log("lock_personalization: do zablokowania " . count($bookings));

foreach ($bookings as $booking) {
    Database::update('bookings', ['personalization_locked_at' => date('Y-m-d H:i:s')], 'id = ?', [$booking['id']]);
    BookingService::changeStatus((int) $booking['id'], 'ready', null, "Personalizacja zablokowana ($days dni przed imprezą)");
    cron_log("  #{$booking['id']} — zablokowano, status: Gotowe do realizacji");
}
