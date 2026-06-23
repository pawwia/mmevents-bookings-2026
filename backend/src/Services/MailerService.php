<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Render szablonów ({{zmienne}}) i kolejkowanie wiadomości.
 * Nic nie jest wysyłane w trakcie żądania HTTP — wysyłką zajmuje się cron.
 */
final class MailerService
{
    public static function render(string $template, array $vars): string
    {
        $vars['stopka'] = $vars['stopka'] ?? nl2br((string) SettingsService::get('company.email_footer', ''));
        return preg_replace_callback(
            '/\{\{\s*(\w+)\s*\}\}/',
            fn($m) => (string) ($vars[$m[1]] ?? ''),
            $template
        );
    }

    /**
     * Kolejkuje e-mail z szablonu o kodzie `code`. Zwraca false gdy szablon nieaktywny.
     * Opcjonalny załącznik (np. podpisany PDF) — ścieżka lokalna + nazwa pliku.
     */
    public static function queueEmail(
        string $code,
        string $recipient,
        ?string $recipientName,
        array $vars,
        ?int $bookingId = null,
        ?string $attachmentPath = null,
        ?string $attachmentName = null,
    ): bool {
        $template = Database::selectOne('SELECT * FROM email_templates WHERE code = ? AND is_active = 1', [$code]);
        if ($template === null) {
            return false;
        }
        // Treść szablonu renderujemy bez {{stopka}} (stopkę zapewnia markowy layout poniżej),
        // czyścimy puste akapity i owijamy w spójną, różową ramkę MMEvent.
        $inner = self::render($template['body'], ['stopka' => ''] + $vars);
        $inner = preg_replace('/<p>\s*<\/p>/iu', '', $inner);

        Database::insert('email_queue', [
            'booking_id' => $bookingId,
            'recipient' => $recipient,
            'recipient_name' => $recipientName,
            'subject' => self::render($template['subject'], $vars),
            'body' => self::wrapEmailHtml($inner),
            'attachment_path' => $attachmentPath,
            'attachment_name' => $attachmentName,
        ]);
        return true;
    }

    /**
     * Owija treść maila w markowy layout (tabele + style inline — zgodne z klientami poczty).
     * Kolory i logo pobierane z ustawień (rebranding bez zmian w kodzie).
     */
    public static function wrapEmailHtml(string $inner): string
    {
        $primary = SettingsService::get('appearance.primary_color', '#E8AEB7');
        $light = SettingsService::get('appearance.secondary_color', '#FDF3F5');
        $name = htmlspecialchars((string) SettingsService::get('company.name', 'MMEvents'));
        $website = (string) SettingsService::get('company.website', '');
        $email = htmlspecialchars((string) SettingsService::get('company.email', ''));
        $phone = htmlspecialchars((string) SettingsService::get('company.phone', ''));

        // Logo: absolutny URL (klienci poczty nie ładują ścieżek względnych)
        $logo = (string) (SettingsService::get('appearance.logo_url') ?: SettingsService::get('company.logo_url', ''));
        if ($logo !== '' && !preg_match('#^https?://#', $logo)) {
            $logo = SettingsService::frontendUrl() . '/' . ltrim($logo, '/');
        }
        $header = $logo !== '' && !str_contains($logo, 'placeholder')
            ? '<img src="' . htmlspecialchars($logo) . '" alt="' . $name . '" height="84" style="display:block;border:0;height:84px;max-height:84px;width:auto">'
            : '<span style="font-size:26px;font-weight:800;letter-spacing:-0.02em;color:#3D2228">' . $name . '</span>';

        // Stopka bez adresu siedziby (na życzenie) — tylko e-mail i telefon
        $contact = array_filter([$email, $phone]);
        $footerContact = $contact ? implode(' &nbsp;•&nbsp; ', $contact) : '';
        $websiteLink = $website !== ''
            ? '<a href="' . htmlspecialchars($website) . '" style="color:#9a6b73;text-decoration:none">' . htmlspecialchars(preg_replace('#^https?://#', '', $website)) . '</a>'
            : '';

        return '<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:' . $light . ';">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' . $light . ';padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td align="center" style="padding:8px 0 20px;">' . $header . '</td></tr>
    <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f0dde1;box-shadow:0 2px 8px rgba(232,174,183,0.18);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:6px;background:' . $primary . ';"></td></tr>
        <tr><td style="padding:32px 36px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2b2b2b;">'
          . $inner .
        '</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 16px 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9a8f91;">
      <div style="font-weight:700;color:#7a6a6d;margin-bottom:4px;">' . $name . '</div>'
      . ($footerContact ? '<div>' . $footerContact . '</div>' : '')
      . ($websiteLink ? '<div style="margin-top:4px;">' . $websiteLink . '</div>' : '')
      . '<div style="margin-top:10px;color:#c3b6b8;">Wiadomość wysłana automatycznie — prosimy na nią nie odpowiadać.</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>';
    }

    /** Kolejkuje SMS z szablonu o kodzie `code` (jeśli SMSAPI włączone). */
    public static function queueSms(string $code, string $phone, array $vars, ?int $bookingId = null): bool
    {
        if (!SettingsService::bool('smsapi.enabled', true)) {
            return false;
        }
        $template = Database::selectOne('SELECT * FROM sms_templates WHERE code = ? AND is_active = 1', [$code]);
        if ($template === null || trim($phone) === '') {
            return false;
        }
        Database::insert('sms_queue', [
            'booking_id' => $bookingId,
            'phone' => $phone,
            'message' => self::render($template['body'], $vars),
        ]);
        return true;
    }

    /** Standardowy zestaw zmiennych dla rezerwacji (używany przez większość maili). */
    public static function bookingVars(array $booking, array $user): array
    {
        return [
            'imie' => $user['first_name'] ?? '',
            'nazwisko' => $user['last_name'] ?? '',
            'data_imprezy' => date('d.m.Y', strtotime($booking['event_date'])),
            'godzina_startu' => substr((string) $booking['start_time'], 0, 5),
            'pakiet' => $booking['package_name'] ?? '',
            'lokalizacja' => trim(($booking['venue_name'] ? $booking['venue_name'] . ', ' : '') . $booking['venue_address']),
            'kwota' => number_format((float) $booking['total_price'], 2, ',', ' '),
            'zadatek' => number_format((float) $booking['deposit_amount'], 2, ',', ' '),
            'numer_konta' => SettingsService::get('finance.bank_account', ''),
            'link_panelu' => SettingsService::frontendUrl() . '/konto',
            'dni_blokady' => (string) SettingsService::int('booking.personalization_lock_days', 3),
            'data_blokady' => date('d.m.Y', strtotime($booking['event_date'] . ' -' . SettingsService::int('booking.personalization_lock_days', 3) . ' days')),
        ];
    }
}
