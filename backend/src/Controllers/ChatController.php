<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\ActivityLog;
use App\Services\BookingService;
use App\Services\ChatService;

/**
 * Mini-czat klient ↔ admin. Klient widzi wątki swoich rezerwacji; admin — wszystkie.
 * Załączniki pobierane przez autoryzowane endpointy (nie leżą w katalogu publicznym).
 */
class ChatController
{
    // ───────────────────────── Klient ─────────────────────────

    public function bookingThreads(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        return Response::json(['threads' => ChatService::threadsForBooking((int) $booking['id'], 'client')]);
    }

    public function createBookingThread(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $subject = trim((string) $request->input('subject', ''));
        $body = trim((string) $request->input('body', ''));
        if ($subject === '' || $body === '') {
            return Response::error('Podaj temat i treść wiadomości', 422);
        }
        try {
            $threadId = ChatService::createThread((int) $booking['id'], 'client', $request->userId(), $subject, $body, $_FILES['file'] ?? null);
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
        ActivityLog::record('chat_message', ['user_id' => $request->userId(), 'booking_id' => $booking['id'], 'ip' => BookingController::clientIp(), 'detail' => 'klient — nowy wątek: ' . $subject]);
        return Response::json(['thread_id' => $threadId], 201);
    }

    public function thread(Request $request): Response
    {
        $thread = $this->ownThread($request);
        if ($thread === null) {
            return Response::notFound('Wątek nie istnieje');
        }
        ChatService::markRead((int) $thread['id'], 'client');
        return Response::json(['thread' => $thread, 'messages' => ChatService::messages((int) $thread['id'])]);
    }

    public function postMessage(Request $request): Response
    {
        $thread = $this->ownThread($request);
        if ($thread === null) {
            return Response::notFound('Wątek nie istnieje');
        }
        $body = trim((string) $request->input('body', ''));
        if ($body === '' && !isset($_FILES['file'])) {
            return Response::error('Wpisz wiadomość lub dodaj załącznik', 422);
        }
        try {
            ChatService::addMessage((int) $thread['id'], 'client', $request->userId(), $body, $_FILES['file'] ?? null);
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
        ActivityLog::record('chat_message', ['user_id' => $request->userId(), 'booking_id' => $thread['booking_id'] ?? null, 'ip' => BookingController::clientIp(), 'detail' => 'klient — odpowiedź w wątku']);
        return Response::json(['ok' => true], 201);
    }

    public function attachment(Request $request): Response
    {
        $message = ChatService::message((int) $request->params['id']);
        if ($message === null) {
            return Response::notFound('Załącznik nie istnieje');
        }
        $thread = ChatService::thread((int) $message['thread_id']);
        if ($thread === null || !$this->bookingOwnedBy($request, (int) $thread['booking_id'])) {
            return Response::notFound('Załącznik nie istnieje');
        }
        return $this->streamAttachment($message);
    }

    // ───────────────────────── Admin (CRM) ─────────────────────────

    public function adminThreads(Request $request): Response
    {
        $bookingId = isset($request->query['booking_id']) ? (int) $request->query['booking_id'] : null;
        return Response::json(['threads' => ChatService::allThreads($bookingId)]);
    }

    public function adminCreateThread(Request $request): Response
    {
        $booking = BookingService::find((int) $request->params['id']);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $subject = trim((string) $request->input('subject', ''));
        $body = trim((string) $request->input('body', ''));
        if ($subject === '' || $body === '') {
            return Response::error('Podaj temat i treść wiadomości', 422);
        }
        try {
            $threadId = ChatService::createThread((int) $booking['id'], 'admin', $request->userId(), $subject, $body, $_FILES['file'] ?? null);
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
        ActivityLog::record('chat_message_admin', ['user_id' => $request->userId(), 'booking_id' => $booking['id'], 'ip' => BookingController::clientIp(), 'detail' => 'admin — nowy wątek: ' . $subject]);
        return Response::json(['thread_id' => $threadId], 201);
    }

    public function adminThread(Request $request): Response
    {
        $thread = ChatService::thread((int) $request->params['id']);
        if ($thread === null) {
            return Response::notFound('Wątek nie istnieje');
        }
        ChatService::markRead((int) $thread['id'], 'admin');
        return Response::json(['thread' => $thread, 'messages' => ChatService::messages((int) $thread['id'])]);
    }

    public function adminPostMessage(Request $request): Response
    {
        $thread = ChatService::thread((int) $request->params['id']);
        if ($thread === null) {
            return Response::notFound('Wątek nie istnieje');
        }
        $body = trim((string) $request->input('body', ''));
        if ($body === '' && !isset($_FILES['file'])) {
            return Response::error('Wpisz wiadomość lub dodaj załącznik', 422);
        }
        try {
            ChatService::addMessage((int) $thread['id'], 'admin', $request->userId(), $body, $_FILES['file'] ?? null);
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 422);
        }
        ActivityLog::record('chat_message_admin', ['user_id' => $request->userId(), 'booking_id' => $thread['booking_id'] ?? null, 'ip' => BookingController::clientIp(), 'detail' => 'admin — odpowiedź w wątku']);
        return Response::json(['ok' => true], 201);
    }

    public function adminAttachment(Request $request): Response
    {
        $message = ChatService::message((int) $request->params['id']);
        if ($message === null) {
            return Response::notFound('Załącznik nie istnieje');
        }
        return $this->streamAttachment($message);
    }

    // ───────────────────────── Pomocnicze ─────────────────────────

    private function ownBooking(Request $request): ?array
    {
        $booking = BookingService::find((int) $request->params['id']);
        return $booking !== null && (int) $booking['user_id'] === $request->userId() ? $booking : null;
    }

    private function bookingOwnedBy(Request $request, int $bookingId): bool
    {
        $booking = BookingService::find($bookingId);
        return $booking !== null && (int) $booking['user_id'] === $request->userId();
    }

    /** Wątek z weryfikacją, że należy do rezerwacji zalogowanego klienta. */
    private function ownThread(Request $request): ?array
    {
        $thread = ChatService::thread((int) $request->params['id']);
        if ($thread === null || !$this->bookingOwnedBy($request, (int) $thread['booking_id'])) {
            return null;
        }
        return $thread;
    }

    private function streamAttachment(array $message): Response
    {
        $path = ChatService::attachmentFullPath($message);
        if ($path === null || !is_file($path)) {
            return Response::notFound('Załącznik został usunięty lub nie istnieje');
        }
        header('Content-Type: ' . ($message['attachment_mime'] ?: 'application/octet-stream'));
        header('Content-Disposition: inline; filename="' . str_replace('"', '', (string) $message['attachment_name']) . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, no-store');
        readfile($path);
        exit;
    }
}
