<?php

declare(strict_types=1);

namespace App\Services;

/** Cienki klient HTTP (curl) dla integracji zewnętrznych. */
final class Http
{
    /**
     * @return array{status:int, body:array|string}
     */
    public static function request(
        string $method,
        string $url,
        array $headers = [],
        array|string|null $body = null,
        int $timeout = 20,
        bool $followRedirects = false,
    ): array {
        $ch = curl_init($url);
        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = "$name: $value";
        }
        $options = [
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => $headerLines,
        ];
        if ($followRedirects) {
            // Apps Script web-app odpowiada 302 na script.googleusercontent.com (echo, tylko GET).
            // CUSTOMREQUEST=POST wymuszałby POST także po przekierowaniu → 405. Używamy CURLOPT_POST,
            // dzięki czemu curl poprawnie przełącza POST→GET na 302.
            $options[CURLOPT_FOLLOWLOCATION] = true;
            $options[CURLOPT_MAXREDIRS] = 5;
            unset($options[CURLOPT_CUSTOMREQUEST]);
            if (strtoupper($method) === 'POST') {
                $options[CURLOPT_POST] = true;
            }
        }
        if ($body !== null) {
            $options[CURLOPT_POSTFIELDS] = is_array($body) ? json_encode($body, JSON_UNESCAPED_UNICODE) : $body;
        }
        curl_setopt_array($ch, $options);
        $response = curl_exec($ch);
        if ($response === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new \RuntimeException("Błąd połączenia HTTP: $error ($url)");
        }
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        $decoded = json_decode($response, true);
        return ['status' => $status, 'body' => is_array($decoded) ? $decoded : $response];
    }

    public static function getJson(string $url, array $headers = []): array
    {
        return self::request('GET', $url, $headers);
    }

    public static function postJson(string $url, array $body, array $headers = []): array
    {
        return self::request('POST', $url, $headers + ['Content-Type' => 'application/json'], $body);
    }
}
