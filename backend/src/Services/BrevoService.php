<?php

declare(strict_types=1);

namespace App\Services;

/** Wysyłka e-maili przez Brevo (https://api.brevo.com/v3). Wywoływane wyłącznie z crona. */
final class BrevoService
{
    /**
     * @param array<int, array{name:string, path:string}> $attachments pliki lokalne do dołączenia (np. podpisany PDF)
     */
    public static function send(
        string $recipient,
        ?string $recipientName,
        string $subject,
        string $htmlBody,
        array $attachments = [],
    ): void {
        $apiKey = SettingsService::get('brevo.api_key');
        if (!$apiKey) {
            throw new \RuntimeException('Brak klucza Brevo API (Ustawienia → Brevo)');
        }
        $payload = [
            'sender' => [
                'email' => SettingsService::get('brevo.sender_email', 'rezerwacje@mmevent.pl'),
                'name' => SettingsService::get('brevo.sender_name', 'MMEvent'),
            ],
            'to' => [array_filter(['email' => $recipient, 'name' => $recipientName])],
            'subject' => $subject,
            'htmlContent' => $htmlBody,
        ];
        foreach ($attachments as $attachment) {
            if (!is_file($attachment['path'])) {
                throw new \RuntimeException('Załącznik nie istnieje: ' . $attachment['path']);
            }
            $payload['attachment'][] = [
                'name' => $attachment['name'],
                'content' => base64_encode((string) file_get_contents($attachment['path'])),
            ];
        }

        $res = Http::postJson('https://api.brevo.com/v3/smtp/email', $payload, ['api-key' => $apiKey]);

        if ($res['status'] >= 300) {
            $detail = is_array($res['body']) ? json_encode($res['body'], JSON_UNESCAPED_UNICODE) : (string) $res['body'];
            throw new \RuntimeException("Brevo odrzuciło wiadomość (HTTP {$res['status']}): $detail");
        }
    }
}
