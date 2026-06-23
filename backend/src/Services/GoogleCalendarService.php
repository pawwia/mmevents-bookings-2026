<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/** Synchronizacja rezerwacji z Google Calendar (Service Account, kalendarz udostępniony kontu serwisowemu). */
final class GoogleCalendarService
{
    private const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    public static function enabled(): bool
    {
        return SettingsService::bool('calendar.enabled') && SettingsService::get('calendar.calendar_id');
    }

    /** Tworzy lub aktualizuje wydarzenie dla rezerwacji. Zwraca google_event_id. */
    public static function syncBooking(array $booking): ?string
    {
        if (!self::enabled()) {
            return null;
        }
        $calendarId = urlencode((string) SettingsService::get('calendar.calendar_id'));
        $headers = ['Authorization' => 'Bearer ' . GoogleAuthService::serviceAccountToken(self::SCOPES)];

        $start = $booking['event_date'] . 'T' . substr((string) $booking['start_time'], 0, 8);
        $endTs = strtotime($start) + (int) round((float) $booking['duration_hours'] * 3600);
        $event = [
            'summary' => sprintf('MMEvent #%d — %s', $booking['id'], $booking['venue_name'] ?: $booking['venue_address']),
            'location' => $booking['venue_address'],
            'description' => sprintf(
                "Rezerwacja #%d\nStatus: %s\nPakiet: %s\nKlient: %s",
                $booking['id'],
                $booking['status'],
                $booking['package_name'] ?? '',
                trim(($booking['first_name'] ?? '') . ' ' . ($booking['last_name'] ?? ''))
            ),
            'start' => ['dateTime' => date('c', strtotime($start))],
            'end' => ['dateTime' => date('c', $endTs)],
        ];

        if (!empty($booking['google_event_id'])) {
            $res = Http::request(
                'PUT',
                "https://www.googleapis.com/calendar/v3/calendars/$calendarId/events/{$booking['google_event_id']}",
                $headers + ['Content-Type' => 'application/json'],
                json_encode($event)
            );
        } else {
            $res = Http::postJson(
                "https://www.googleapis.com/calendar/v3/calendars/$calendarId/events",
                $event,
                $headers
            );
        }
        if ($res['status'] >= 300) {
            throw new \RuntimeException('Google Calendar: ' . json_encode($res['body'], JSON_UNESCAPED_UNICODE));
        }
        $eventId = $res['body']['id'] ?? null;
        if ($eventId && $eventId !== ($booking['google_event_id'] ?? null)) {
            Database::update('bookings', ['google_event_id' => $eventId], 'id = ?', [$booking['id']]);
        }
        return $eventId;
    }

    public static function deleteEvent(string $googleEventId): void
    {
        if (!self::enabled()) {
            return;
        }
        $calendarId = urlencode((string) SettingsService::get('calendar.calendar_id'));
        Http::request(
            'DELETE',
            "https://www.googleapis.com/calendar/v3/calendars/$calendarId/events/$googleEventId",
            ['Authorization' => 'Bearer ' . GoogleAuthService::serviceAccountToken(self::SCOPES)]
        );
    }
}
