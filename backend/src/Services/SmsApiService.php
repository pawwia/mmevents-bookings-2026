<?php

declare(strict_types=1);

namespace App\Services;

/** Wysyłka SMS przez SMSAPI.pl (OAuth token). Wywoływane wyłącznie z crona. */
final class SmsApiService
{
    public static function send(string $phone, string $message): void
    {
        $token = SettingsService::get('smsapi.token');
        if (!$token) {
            throw new \RuntimeException('Brak tokenu SMSAPI (Ustawienia → SMSAPI)');
        }
        $res = Http::request('POST', 'https://api.smsapi.pl/sms.do', [
            'Authorization' => "Bearer $token",
            'Content-Type' => 'application/x-www-form-urlencoded',
        ], http_build_query([
            'to' => preg_replace('/[^0-9+]/', '', $phone),
            'from' => SettingsService::get('smsapi.sender', 'MMEvent'),
            'message' => $message,
            'encoding' => 'utf-8',
            'format' => 'json',
        ]));

        $body = $res['body'];
        if ($res['status'] >= 300 || (is_array($body) && isset($body['error']))) {
            $code = is_array($body) ? (int) ($body['error'] ?? 0) : 0;
            // Najczęstsze błędy SMSAPI — czytelny komunikat z podpowiedzią
            $hint = match ($code) {
                14 => 'nazwa nadawcy „' . SettingsService::get('smsapi.sender', '')
                    . '" nie jest zatwierdzona w SMSAPI. Zarejestruj pole nadawcy (Ustawienia → Pola nadawcy) '
                    . 'lub wpisz w CRM nadawcę „Test" do testów na własny numer.',
                101, 102 => 'nieprawidłowy lub nieaktywny token SMSAPI (Ustawienia → SMSAPI).',
                103 => 'brak punktów na koncie SMSAPI — doładuj konto.',
                default => is_array($body) ? json_encode($body, JSON_UNESCAPED_UNICODE) : (string) $body,
            };
            throw new \RuntimeException('SMSAPI: ' . $hint);
        }
    }
}
