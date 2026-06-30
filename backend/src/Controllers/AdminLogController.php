<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\QueueService;
use App\Services\SettingsService;

/** CRM → Logi: stan kolejek e-mail/SMS, błędy, log systemowy i ręczne „Wyślij teraz". */
class AdminLogController
{
    /** Podsumowanie + ostatnie wpisy obu kolejek + diagnostyka konfiguracji. */
    public function index(Request $request): Response
    {
        return Response::json([
            'email' => $this->queueSnapshot('email_queue'),
            'sms' => $this->queueSnapshot('sms_queue'),
            'config' => [
                'brevo_api_key_set' => SettingsService::get('brevo.api_key') !== '' && SettingsService::get('brevo.api_key') !== null,
                'brevo_sender' => SettingsService::get('brevo.sender_email'),
                'smsapi_enabled' => SettingsService::bool('smsapi.enabled', true),
                'smsapi_token_set' => SettingsService::get('smsapi.token') !== '' && SettingsService::get('smsapi.token') !== null,
            ],
        ]);
    }

    /** Lista wpisów kolejki e-mail (filtr ?status=pending|sent|failed). */
    public function emails(Request $request): Response
    {
        return Response::json($this->queueRows('email_queue', $request->query['status'] ?? null));
    }

    /** Lista wpisów kolejki SMS. */
    public function sms(Request $request): Response
    {
        return Response::json($this->queueRows('sms_queue', $request->query['status'] ?? null));
    }

    /**
     * Dziennik aktywności serwisu — logowania, resety hasła, blokady, personalizacja…
     * Filtry: ?event=login_fail (konkretne zdarzenie) oraz ?q=fraza (e-mail / IP / opis).
     */
    public function activity(Request $request): Response
    {
        $where = [];
        $params = [];
        if (!empty($request->query['event'])) {
            $where[] = 'a.event = ?';
            $params[] = $request->query['event'];
        }
        if (!empty($request->query['q'])) {
            $like = '%' . $request->query['q'] . '%';
            $where[] = '(a.email LIKE ? OR a.ip LIKE ? OR a.detail LIKE ?)';
            array_push($params, $like, $like, $like);
        }
        $sql = 'SELECT a.id, a.event, a.email, a.ip, a.booking_id, a.detail, a.created_at,
                       u.first_name, u.last_name
                FROM activity_log a
                LEFT JOIN users u ON u.id = a.user_id'
            . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
            . ' ORDER BY a.id DESC LIMIT 200';
        return Response::json(['rows' => Database::select($sql, $params)]);
    }

    /** Log systemowy (php-error.log lub cron.log) — ostatnie linie. */
    public function systemLog(Request $request): Response
    {
        $which = ($request->query['file'] ?? 'php') === 'cron' ? 'cron.log' : 'php-error.log';
        $path = App::basePath() . '/storage/logs/' . $which;
        if (!is_file($path)) {
            return Response::json(['file' => $which, 'lines' => [], 'note' => 'Brak pliku logu (jeszcze nic nie zapisano).']);
        }
        $lines = array_slice(array_filter(explode("\n", (string) file_get_contents($path))), -200);
        return Response::json(['file' => $which, 'lines' => array_values($lines)]);
    }

    /** Ręczne przetworzenie kolejek (diagnostyka i awaryjna wysyłka, gdy cron nie działa). */
    public function processQueue(Request $request): Response
    {
        $email = QueueService::processEmails(50);
        $sms = QueueService::processSms(50);
        return Response::json(['email' => $email, 'sms' => $sms]);
    }

    /** Ponów nieudane wpisy (reset statusu na pending). */
    public function retryFailed(Request $request): Response
    {
        $type = ($request->input('type') === 'sms') ? 'sms_queue' : 'email_queue';
        $count = Database::execute(
            "UPDATE `$type` SET status = 'pending', attempts = 0, last_error = NULL WHERE status = 'failed'"
        );
        return Response::json(['ok' => true, 'reset' => $count]);
    }

    private function queueSnapshot(string $table): array
    {
        $out = ['pending' => 0, 'sent' => 0, 'failed' => 0];
        foreach (Database::select("SELECT status, COUNT(*) c FROM `$table` GROUP BY status") as $row) {
            $out[$row['status']] = (int) $row['c'];
        }
        return $out;
    }

    private function queueRows(string $table, ?string $status): array
    {
        $where = '';
        $params = [];
        if (in_array($status, ['pending', 'sent', 'failed'], true)) {
            $where = 'WHERE status = ?';
            $params[] = $status;
        }
        $isEmail = $table === 'email_queue';
        $cols = $isEmail
            ? 'id, recipient AS target, subject AS title, status, attempts, last_error, scheduled_at, sent_at, created_at'
            : 'id, phone AS target, message AS title, status, attempts, last_error, scheduled_at, sent_at, created_at';
        return Database::select("SELECT $cols FROM `$table` $where ORDER BY id DESC LIMIT 100", $params);
    }
}
