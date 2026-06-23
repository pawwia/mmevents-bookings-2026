<?php

declare(strict_types=1);

namespace App\Services;

/** Google Drive — opcjonalne archiwum podpisanych umów (umowy generuje lokalnie PdfService). */
final class GoogleDriveService
{
    /**
     * Wgrywa plik binarny (PDF) na Drive do wskazanego folderu (multipart upload).
     * Token: OAuth właściciela jeśli połączony, inaczej konto serwisowe. Zwraca id i webViewLink.
     */
    public static function uploadFile(string $name, string $bytes, string $mime, string $folderId): array
    {
        $token = GoogleAuthService::driveAccessToken();
        $metadata = ['name' => $name];
        if ($folderId !== '') {
            $metadata['parents'] = [$folderId];
        }
        $boundary = 'mmevent' . bin2hex(random_bytes(8));
        $body = "--$boundary\r\n"
            . "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            . json_encode($metadata, JSON_UNESCAPED_UNICODE) . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: $mime\r\n\r\n"
            . $bytes . "\r\n"
            . "--$boundary--";

        $res = Http::request(
            'POST',
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true',
            [
                'Authorization' => "Bearer $token",
                'Content-Type' => "multipart/related; boundary=$boundary",
            ],
            $body,
            60
        );
        if ($res['status'] >= 300 || empty($res['body']['id'])) {
            throw new \RuntimeException('Nie udało się zapisać pliku na Drive: ' . json_encode($res['body'], JSON_UNESCAPED_UNICODE));
        }
        return ['id' => $res['body']['id'], 'url' => $res['body']['webViewLink'] ?? null];
    }
}
