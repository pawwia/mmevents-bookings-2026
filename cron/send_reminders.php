<?php

/**
 * Przypomnienia X dni przed imprezą (domyślnie 7) — e-mail + SMS wg ustawień.
 * Ustawia też status "last_call" (Last call personalizacji).
 * Zalecane: raz dziennie o godzinie z ustawienia booking.cron_hour.
 */

declare(strict_types=1);

use App\Core\Database;
use App\Services\BookingService;
use App\Services\MailerService;
use App\Services\SettingsService;

require __DIR__ . '/bootstrap.php';

$days = SettingsService::int('booking.reminder_days', 7);
$targetDate = date('Y-m-d', strtotime("+$days days"));

$bookings = Database::select(
    "SELECT b.*, p.name AS package_name, u.first_name, u.last_name, u.email, u.phone
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN packages p ON p.id = b.package_id
     WHERE b.event_date = ?
       AND b.status IN ('confirmed', 'awaiting_deposit')
       AND b.reminder_sent_at IS NULL",
    [$targetDate]
);
cron_log("reminders: imprezy $targetDate — " . count($bookings));

foreach ($bookings as $booking) {
    $vars = MailerService::bookingVars($booking, $booking) + ['dni' => (string) $days];

    if (SettingsService::bool('booking.reminder_email', true)) {
        MailerService::queueEmail('reminder_7days', $booking['email'], $booking['first_name'], $vars, (int) $booking['id']);
    }
    if (SettingsService::bool('booking.reminder_sms', true)) {
        MailerService::queueSms('reminder_7days', (string) $booking['phone'], $vars, (int) $booking['id']);
    }
    Database::update('bookings', ['reminder_sent_at' => date('Y-m-d H:i:s')], 'id = ?', [$booking['id']]);

    if ($booking['status'] === 'confirmed') {
        BookingService::changeStatus((int) $booking['id'], 'last_call', null, "Przypomnienie $days dni przed imprezą");
    }
    cron_log("  #{$booking['id']} — zakolejkowano przypomnienia");
}
