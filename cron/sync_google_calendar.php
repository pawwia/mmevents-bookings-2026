<?php

/**
 * Dosynchronizowanie rezerwacji do Google Calendar (np. utworzonych gdy API było niedostępne).
 * Zalecane: co 15 minut.
 */

declare(strict_types=1);

use App\Core\Database;
use App\Services\GoogleCalendarService;

require __DIR__ . '/bootstrap.php';

if (!GoogleCalendarService::enabled()) {
    cron_log('calendar_sync: synchronizacja wyłączona w ustawieniach — pomijam');
    exit;
}

$bookings = Database::select(
    "SELECT b.*, p.name AS package_name, u.first_name, u.last_name
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN packages p ON p.id = b.package_id
     WHERE b.google_event_id IS NULL
       AND b.status NOT IN ('cancelled', 'new')
       AND b.event_date >= CURDATE()
     LIMIT 20"
);
cron_log('calendar_sync: do synchronizacji ' . count($bookings));

foreach ($bookings as $booking) {
    try {
        $eventId = GoogleCalendarService::syncBooking($booking);
        cron_log("  #{$booking['id']} → $eventId");
    } catch (Throwable $e) {
        cron_log("  BŁĄD #{$booking['id']}: " . $e->getMessage());
    }
}
