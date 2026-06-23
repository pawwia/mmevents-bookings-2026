<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/** Centralna logika rezerwacji: zmiany statusów + efekty uboczne (maile, SMS, kalendarz). */
final class BookingService
{
    public const STATUSES = [
        'new' => 'Nowe zapytanie',
        'awaiting_contract' => 'Oczekuje na umowę i potwierdzenie',
        'awaiting_deposit' => 'Oczekuje na zadatek',
        'confirmed' => 'Rezerwacja potwierdzona',
        'last_call' => 'Last call personalizacji',
        'ready' => 'Gotowe do realizacji',
        'completed' => 'Zrealizowane',
        'cancelled' => 'Anulowane',
    ];

    /** Pełny wiersz rezerwacji z danymi klienta i pakietu. */
    public static function find(int $id): ?array
    {
        return Database::selectOne(
            'SELECT b.*, p.name AS package_name, u.first_name, u.last_name, u.email, u.phone
             FROM bookings b
             JOIN users u ON u.id = b.user_id
             JOIN packages p ON p.id = b.package_id
             WHERE b.id = ?',
            [$id]
        );
    }

    /** Zmiana statusu z historią i efektami ubocznymi. */
    public static function changeStatus(int $bookingId, string $newStatus, ?int $changedBy = null, ?string $note = null): array
    {
        if (!isset(self::STATUSES[$newStatus])) {
            throw new \InvalidArgumentException("Nieznany status: $newStatus");
        }
        $booking = self::find($bookingId);
        if ($booking === null) {
            throw new \RuntimeException('Rezerwacja nie istnieje');
        }
        $oldStatus = $booking['status'];
        if ($oldStatus === $newStatus) {
            return $booking;
        }

        Database::update('bookings', ['status' => $newStatus], 'id = ?', [$bookingId]);
        Database::insert('booking_status_history', [
            'booking_id' => $bookingId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'changed_by' => $changedBy,
            'note' => $note,
        ]);

        $booking['status'] = $newStatus;
        $user = ['first_name' => $booking['first_name'], 'last_name' => $booking['last_name'],
                 'email' => $booking['email'], 'phone' => $booking['phone']];
        $vars = MailerService::bookingVars($booking, $user);

        // Efekty uboczne zmian statusu
        switch ($newStatus) {
            case 'awaiting_deposit':
                $contract = Database::selectOne(
                    'SELECT number FROM contracts WHERE booking_id = ? ORDER BY id DESC LIMIT 1', [$bookingId]
                );
                $vars['numer_umowy'] = $contract['number'] ?? '';
                MailerService::queueEmail('awaiting_deposit', $booking['email'], $booking['first_name'], $vars, $bookingId);
                break;
            case 'confirmed':
                $paidInfo = self::paidSummary($bookingId, (float) $booking['total_price']);
                $vars['wplacono'] = number_format($paidInfo['paid'], 2, ',', ' ');
                $vars['pozostalo'] = number_format($paidInfo['remaining'], 2, ',', ' ');
                MailerService::queueEmail('deposit_received', $booking['email'], $booking['first_name'], $vars, $bookingId);
                MailerService::queueSms('deposit_received', (string) $booking['phone'], $vars, $bookingId);
                break;
            case 'completed':
                MailerService::queueEmail('thank_you', $booking['email'], $booking['first_name'], $vars, $bookingId);
                break;
            case 'cancelled':
                if (!empty($booking['google_event_id'])) {
                    try {
                        GoogleCalendarService::deleteEvent($booking['google_event_id']);
                        Database::update('bookings', ['google_event_id' => null], 'id = ?', [$bookingId]);
                    } catch (\Throwable $e) {
                        error_log('Calendar delete: ' . $e->getMessage());
                    }
                }
                break;
        }

        if (!in_array($newStatus, ['cancelled'], true)) {
            try {
                GoogleCalendarService::syncBooking($booking);
            } catch (\Throwable $e) {
                error_log('Calendar sync: ' . $e->getMessage());
            }
        }

        return $booking;
    }

    /** Powiadomienie właściciela (company.email) o nowej rezerwacji — kreator i akceptacja oferty. */
    public static function notifyOwner(int $bookingId): void
    {
        $ownerEmail = SettingsService::get('company.email');
        if (!$ownerEmail) {
            return;
        }
        $booking = self::find($bookingId);
        if ($booking === null) {
            return;
        }
        $guests = (int) ($booking['guests_count'] ?? 0);
        $individual = (bool) ($booking['requires_individual_quote'] ?? false);
        $crmLink = SettingsService::frontendUrl() . '/admin/rezerwacje/' . $bookingId;

        MailerService::queueEmail('admin_new_booking', $ownerEmail, SettingsService::get('company.name', 'MMEvents'), [
            'booking_id' => (string) $bookingId,
            'status' => self::STATUSES[$booking['status']] ?? $booking['status'],
            'typ_imprezy' => (string) ($booking['event_type'] ?? ''),
            'liczba_osob_info' => $guests > 0 ? " ($guests osób)" : '',
            'data_imprezy' => date('d.m.Y', strtotime($booking['event_date'])),
            'godzina_startu' => substr((string) $booking['start_time'], 0, 5),
            'pakiet' => $booking['package_name'] ?? '',
            'lokalizacja' => trim((($booking['venue_name'] ?? '') ? $booking['venue_name'] . ', ' : '') . $booking['venue_address']),
            'imie' => $booking['first_name'],
            'nazwisko' => $booking['last_name'],
            'telefon' => $booking['phone'],
            'email' => $booking['email'],
            'kwota' => number_format((float) $booking['total_price'], 2, ',', ' ') . ' zł',
            'zadatek' => number_format((float) $booking['deposit_amount'], 2, ',', ' ') . ' zł',
            'wycena_indywidualna_info' => $individual
                ? '<p style="color:#b26a00"><strong>Uwaga: impreza podlega wycenie indywidualnej — przygotuj ofertę.</strong></p>'
                : '',
            'link_crm' => $crmLink,
        ], $bookingId);
    }

    /** Suma wpłat klienta i kwota pozostała do zapłaty. */
    public static function paidSummary(int $bookingId, float $totalPrice): array
    {
        $row = Database::selectOne(
            "SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE booking_id = ? AND status = 'paid'",
            [$bookingId]
        );
        $paid = (float) ($row['paid'] ?? 0);
        return ['paid' => $paid, 'remaining' => max(0.0, round($totalPrice - $paid, 2))];
    }

    /** Checklista realizacji dla CRM. */
    public static function checklist(int $bookingId): array
    {
        $booking = self::find($bookingId);
        if ($booking === null) {
            throw new \RuntimeException('Rezerwacja nie istnieje');
        }
        $pers = Database::selectOne(
            'SELECT bp.*, a.name AS animation_name, a.thumbnail_url AS animation_thumbnail, a.youtube_url AS animation_youtube,
                    bg.name AS background_name, bg.image_url AS background_image,
                    pt.name AS template_name, pt.image_url AS template_image,
                    gd.name AS guestbook_design_name, gd.image_url AS guestbook_design_image
             FROM booking_personalizations bp
             LEFT JOIN animations a ON a.id = bp.animation_id
             LEFT JOIN backgrounds bg ON bg.id = bp.background_id
             LEFT JOIN print_templates pt ON pt.id = bp.print_template_id
             LEFT JOIN guestbook_designs gd ON gd.id = bp.guestbook_design_id
             WHERE bp.booking_id = ?',
            [$bookingId]
        );
        $contract = Database::selectOne(
            "SELECT number, status, signed_at, drive_url FROM contracts
             WHERE booking_id = ? AND status != 'cancelled' ORDER BY id DESC LIMIT 1",
            [$bookingId]
        );
        $deposit = Database::selectOne(
            "SELECT status, amount, paid_at FROM payments
             WHERE booking_id = ? AND type = 'deposit' ORDER BY id DESC LIMIT 1",
            [$bookingId]
        );

        return [
            'animation' => $pers['animation_name'] ?? null,
            'animation_thumbnail' => $pers['animation_thumbnail'] ?? null,
            'animation_youtube' => $pers['animation_youtube'] ?? null,
            'background' => $pers['background_name'] ?? null,
            'background_image' => $pers['background_image'] ?? null,
            'print_template' => $pers['template_name'] ?? null,
            'print_template_image' => $pers['template_image'] ?? null,
            'print_text' => $pers['print_text'] ?? null,
            'guestbook' => $booking['guestbook'],
            'guestbook_design' => $pers['guestbook_design_name'] ?? null,
            'guestbook_design_image' => $pers['guestbook_design_image'] ?? null,
            'guestbook_names' => $pers['guestbook_names'] ?? null,
            'guestbook_date' => $pers['guestbook_date'] ?? null,
            'contract' => $contract,
            'contract_signed' => ($contract['status'] ?? null) === 'signed',
            'deposit_paid' => ($deposit['status'] ?? null) === 'paid',
            'deposit' => $deposit,
            'status' => $booking['status'],
            'status_label' => self::STATUSES[$booking['status']],
        ];
    }
}
