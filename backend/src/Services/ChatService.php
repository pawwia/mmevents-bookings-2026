<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\Database;

/**
 * Mini-czat klient ↔ admin: wątki tematyczne powiązane z rezerwacją, wiadomości i załączniki.
 * Załączniki trzymane w backend/storage/chat/{thread} (poza public) — kasowane po imprezie.
 */
final class ChatService
{
    private const ALLOWED = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
        'image/gif' => 'gif', 'application/pdf' => 'pdf',
    ];
    private const MAX_BYTES = 10 * 1024 * 1024;

    /** Kolumna „ostatnio przeczytane" dla strony (whitelist — bezpieczne w SQL). */
    private static function readColumn(string $side): string
    {
        return $side === 'admin' ? 'admin_last_read_at' : 'client_last_read_at';
    }

    /** Wątki danej rezerwacji z licznikiem nieprzeczytanych dla strony i podglądem ostatniej wiadomości. */
    public static function threadsForBooking(int $bookingId, string $side): array
    {
        $col = self::readColumn($side);
        return Database::select(
            "SELECT t.*,
                (SELECT COUNT(*) FROM chat_messages m
                  WHERE m.thread_id = t.id AND m.sender <> ?
                    AND m.created_at > COALESCE(t.$col, '1970-01-01')) AS unread,
                (SELECT m.body FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body
             FROM chat_threads t
             WHERE t.booking_id = ?
             ORDER BY t.last_message_at DESC, t.id DESC",
            [$side, $bookingId]
        );
    }

    /** Wszystkie wątki dla CRM (z danymi rezerwacji/klienta i liczbą nieprzeczytanych dla admina). */
    public static function allThreads(?int $bookingId = null): array
    {
        $where = $bookingId !== null ? 'WHERE t.booking_id = ?' : '';
        $params = $bookingId !== null ? [$bookingId] : [];
        return Database::select(
            "SELECT t.*, b.event_date, u.first_name, u.last_name, u.email,
                (SELECT COUNT(*) FROM chat_messages m
                  WHERE m.thread_id = t.id AND m.sender <> 'admin'
                    AND m.created_at > COALESCE(t.admin_last_read_at, '1970-01-01')) AS unread,
                (SELECT m.body FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body
             FROM chat_threads t
             JOIN bookings b ON b.id = t.booking_id
             JOIN users u ON u.id = b.user_id
             $where
             ORDER BY t.last_message_at DESC, t.id DESC",
            $params
        );
    }

    public static function thread(int $threadId): ?array
    {
        return Database::selectOne('SELECT * FROM chat_threads WHERE id = ?', [$threadId]);
    }

    /** Wiadomości wątku (bez ścieżek dyskowych — załącznik pobierany osobnym endpointem). */
    public static function messages(int $threadId): array
    {
        $rows = Database::select(
            'SELECT id, sender, sender_user_id, body, attachment_name, attachment_mime, attachment_path, created_at
             FROM chat_messages WHERE thread_id = ? ORDER BY id',
            [$threadId]
        );
        return array_map(static function (array $m): array {
            return [
                'id' => (int) $m['id'],
                'sender' => $m['sender'],
                'body' => $m['body'],
                'attachment_name' => $m['attachment_name'],
                'attachment_mime' => $m['attachment_mime'],
                // path tylko jako wskaźnik „czy jest plik" — true dopóki nie skasowany po imprezie
                'has_attachment' => !empty($m['attachment_path']),
                'attachment_removed' => $m['attachment_name'] !== null && empty($m['attachment_path']),
                'created_at' => $m['created_at'],
            ];
        }, $rows);
    }

    /** Tworzy wątek z pierwszą wiadomością. */
    public static function createThread(
        int $bookingId,
        string $side,
        ?int $userId,
        string $subject,
        string $body,
        ?array $file = null,
    ): int {
        $threadId = Database::insert('chat_threads', [
            'booking_id' => $bookingId,
            'subject' => mb_substr(trim($subject), 0, 150),
            'created_by' => $side,
        ]);
        self::addMessage($threadId, $side, $userId, $body, $file);
        return $threadId;
    }

    /** Dodaje wiadomość do wątku, aktualizuje znaczniki i oznacza wątek przeczytany dla nadawcy. */
    public static function addMessage(
        int $threadId,
        string $side,
        ?int $userId,
        string $body,
        ?array $file = null,
    ): int {
        $attachment = $file !== null ? self::storeAttachment($threadId, $file) : null;
        $now = date('Y-m-d H:i:s');
        $messageId = Database::insert('chat_messages', [
            'thread_id' => $threadId,
            'sender' => $side,
            'sender_user_id' => $userId,
            'body' => trim($body) !== '' ? trim($body) : null,
            'attachment_path' => $attachment['path'] ?? null,
            'attachment_name' => $attachment['name'] ?? null,
            'attachment_mime' => $attachment['mime'] ?? null,
        ]);
        // Nadawca z definicji „przeczytał" własną wiadomość.
        $readCol = self::readColumn($side);
        Database::execute(
            "UPDATE chat_threads SET last_message_at = ?, last_sender = ?, $readCol = ? WHERE id = ?",
            [$now, $side, $now, $threadId]
        );
        return $messageId;
    }

    /** Oznacza wątek jako przeczytany przez stronę (po otwarciu rozmowy). */
    public static function markRead(int $threadId, string $side): void
    {
        $col = self::readColumn($side);
        Database::execute("UPDATE chat_threads SET $col = ? WHERE id = ?", [date('Y-m-d H:i:s'), $threadId]);
    }

    public static function message(int $messageId): ?array
    {
        return Database::selectOne('SELECT * FROM chat_messages WHERE id = ?', [$messageId]);
    }

    /** Absolutna ścieżka załącznika na dysku (lub null). */
    public static function attachmentFullPath(array $message): ?string
    {
        if (empty($message['attachment_path'])) {
            return null;
        }
        return App::basePath() . '/storage/' . $message['attachment_path'];
    }

    /** Zapisuje załącznik w backend/storage/chat/{thread}. @return array{path,name,mime} */
    private static function storeAttachment(int $threadId, array $file): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('Nie udało się przesłać załącznika');
        }
        if ($file['size'] > self::MAX_BYTES) {
            throw new \RuntimeException('Załącznik jest za duży (maks. 10 MB)');
        }
        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!isset(self::ALLOWED[$mime])) {
            throw new \RuntimeException('Dozwolone załączniki: JPG, PNG, WEBP, GIF, PDF');
        }
        $dir = App::basePath() . "/storage/chat/$threadId";
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            throw new \RuntimeException('Nie udało się utworzyć katalogu załączników');
        }
        $filename = bin2hex(random_bytes(12)) . '.' . self::ALLOWED[$mime];
        if (!move_uploaded_file($file['tmp_name'], "$dir/$filename")) {
            throw new \RuntimeException('Nie udało się zapisać załącznika');
        }
        return [
            'path' => "chat/$threadId/$filename",
            'name' => mb_substr((string) ($file['name'] ?? $filename), 0, 255),
            'mime' => $mime,
        ];
    }

    /**
     * Powiadomienia o nowych wiadomościach (cron co 2h). Dla każdego wątku z nieobsłużonymi
     * wiadomościami wysyła JEDEN e-mail do strony przeciwnej i oznacza wiadomości jako notified.
     * @return int liczba wysłanych powiadomień
     */
    public static function notifyPending(): int
    {
        $pending = Database::select(
            "SELECT DISTINCT t.id, t.subject, t.booking_id,
                    SUM(m.sender = 'client') AS from_client,
                    SUM(m.sender = 'admin')  AS from_admin
             FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
             WHERE m.notified = 0
             GROUP BY t.id, t.subject, t.booking_id"
        );
        $frontend = SettingsService::frontendUrl();
        $footer = nl2br((string) SettingsService::get('company.email_footer', ''));
        $sent = 0;

        foreach ($pending as $row) {
            $threadId = (int) $row['id'];
            $booking = BookingService::find((int) $row['booking_id']);
            if ($booking === null) {
                Database::execute('UPDATE chat_messages SET notified = 1 WHERE thread_id = ?', [$threadId]);
                continue;
            }
            // Wiadomości klienta → powiadom admina; wiadomości admina → powiadom klienta.
            if ((int) $row['from_client'] > 0) {
                $owner = (string) SettingsService::get('company.email', '');
                if ($owner !== '') {
                    MailerService::queueEmail('chat_new_message', $owner, SettingsService::get('signing.owner_name', 'MMEvents'), [
                        'imie' => SettingsService::get('signing.owner_name', 'MMEvents'),
                        'temat' => $row['subject'],
                        'link' => "$frontend/admin/rezerwacje/{$booking['id']}",
                        'stopka' => $footer,
                    ], (int) $booking['id']);
                    $sent++;
                }
            }
            if ((int) $row['from_admin'] > 0) {
                MailerService::queueEmail('chat_new_message', $booking['email'], $booking['first_name'], [
                    'imie' => $booking['first_name'] ?: 'Kliencie',
                    'temat' => $row['subject'],
                    'link' => "$frontend/konto/rezerwacje/{$booking['id']}",
                    'stopka' => $footer,
                ], (int) $booking['id']);
                $sent++;
            }
            Database::execute('UPDATE chat_messages SET notified = 1 WHERE thread_id = ? AND notified = 0', [$threadId]);
        }
        return $sent;
    }

    /**
     * Kasuje pliki załączników z czatów rezerwacji, których impreza już się odbyła.
     * Treść wiadomości zostaje; znika tylko plik (path = NULL, nazwa zostaje jako ślad).
     * @return int liczba skasowanych plików
     */
    public static function cleanupPastEventAttachments(): int
    {
        $rows = Database::select(
            "SELECT m.id, m.attachment_path FROM chat_messages m
             JOIN chat_threads t ON t.id = m.thread_id
             JOIN bookings b ON b.id = t.booking_id
             WHERE m.attachment_path IS NOT NULL AND b.event_date < CURDATE()"
        );
        $removed = 0;
        foreach ($rows as $row) {
            $full = App::basePath() . '/storage/' . $row['attachment_path'];
            if (is_file($full)) {
                @unlink($full);
            }
            Database::update('chat_messages', ['attachment_path' => null], 'id = ?', [(int) $row['id']]);
            $removed++;
        }
        return $removed;
    }
}
