<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use Throwable;

/**
 * Przetwarzanie kolejek e-mail i SMS — wspólna logika dla crona oraz ręcznego
 * „Wyślij teraz" w CRM. Retry do 3 prób, log błędów w kolumnie last_error.
 */
final class QueueService
{
    private const MAX_ATTEMPTS = 3;

    /**
     * Wysyła oczekujące e-maile przez Brevo.
     * @param callable|null $log opcjonalny logger (np. cron_log)
     * @return array{processed:int, sent:int, failed:int}
     */
    public static function processEmails(int $limit = 25, ?callable $log = null): array
    {
        $batch = Database::select(
            "SELECT * FROM email_queue
             WHERE status = 'pending' AND scheduled_at <= NOW() AND attempts < ?
             ORDER BY id LIMIT $limit",
            [self::MAX_ATTEMPTS]
        );
        $sent = 0;
        $failed = 0;
        foreach ($batch as $email) {
            try {
                $attachments = [];
                if (!empty($email['attachment_path']) && is_file($email['attachment_path'])) {
                    $attachments[] = [
                        'name' => $email['attachment_name'] ?: basename($email['attachment_path']),
                        'path' => $email['attachment_path'],
                    ];
                }
                BrevoService::send($email['recipient'], $email['recipient_name'], $email['subject'], $email['body'], $attachments);
                Database::update('email_queue', [
                    'status' => 'sent',
                    'sent_at' => date('Y-m-d H:i:s'),
                    'attempts' => (int) $email['attempts'] + 1,
                ], 'id = ?', [$email['id']]);
                $sent++;
                $log && $log("e-mail #{$email['id']} → {$email['recipient']}: wysłano");
            } catch (Throwable $e) {
                $attempts = (int) $email['attempts'] + 1;
                Database::update('email_queue', [
                    'status' => $attempts >= self::MAX_ATTEMPTS ? 'failed' : 'pending',
                    'attempts' => $attempts,
                    'last_error' => $e->getMessage(),
                ], 'id = ?', [$email['id']]);
                $failed++;
                $log && $log("e-mail #{$email['id']} BŁĄD (próba $attempts): " . $e->getMessage());
            }
        }
        return ['processed' => count($batch), 'sent' => $sent, 'failed' => $failed];
    }

    /**
     * Wysyła oczekujące SMS przez SMSAPI.
     * @return array{processed:int, sent:int, failed:int}
     */
    public static function processSms(int $limit = 25, ?callable $log = null): array
    {
        if (!SettingsService::bool('smsapi.enabled', true)) {
            $log && $log('SMS: SMSAPI wyłączone w ustawieniach');
            return ['processed' => 0, 'sent' => 0, 'failed' => 0];
        }
        $batch = Database::select(
            "SELECT * FROM sms_queue
             WHERE status = 'pending' AND scheduled_at <= NOW() AND attempts < ?
             ORDER BY id LIMIT $limit",
            [self::MAX_ATTEMPTS]
        );
        $sent = 0;
        $failed = 0;
        foreach ($batch as $sms) {
            try {
                SmsApiService::send($sms['phone'], $sms['message']);
                Database::update('sms_queue', [
                    'status' => 'sent',
                    'sent_at' => date('Y-m-d H:i:s'),
                    'attempts' => (int) $sms['attempts'] + 1,
                ], 'id = ?', [$sms['id']]);
                $sent++;
                $log && $log("SMS #{$sms['id']} → {$sms['phone']}: wysłano");
            } catch (Throwable $e) {
                $attempts = (int) $sms['attempts'] + 1;
                Database::update('sms_queue', [
                    'status' => $attempts >= self::MAX_ATTEMPTS ? 'failed' : 'pending',
                    'attempts' => $attempts,
                    'last_error' => $e->getMessage(),
                ], 'id = ?', [$sms['id']]);
                $failed++;
                $log && $log("SMS #{$sms['id']} BŁĄD (próba $attempts): " . $e->getMessage());
            }
        }
        return ['processed' => count($batch), 'sent' => $sent, 'failed' => $failed];
    }
}
