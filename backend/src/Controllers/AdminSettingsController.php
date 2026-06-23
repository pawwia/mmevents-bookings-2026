<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\BackupService;
use App\Services\SettingsService;

/** CRM: Ustawienia systemu (12 sekcji) + audyt zmian. */
class AdminSettingsController
{
    public function index(Request $request): Response
    {
        return Response::json(SettingsService::allGrouped());
    }

    /** Natychmiastowa kopia zapasowa bazy — pobierany plik .sql (tylko admin). */
    public function backup(Request $request): Response
    {
        $sql = BackupService::dumpSql();
        $name = BackupService::filename();
        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Content-Length: ' . strlen($sql));
        header('Cache-Control: private, no-store');
        echo $sql;
        exit;
    }

    /** Batch update: { "values": { "finance.km_rate": "1.60", ... } } — każdy zapis audytowany. */
    public function update(Request $request): Response
    {
        $values = $request->input('values');
        if (!is_array($values) || $values === []) {
            return Response::error('Brak wartości do zapisania', 422);
        }
        $saved = [];
        $unknown = [];
        foreach ($values as $key => $value) {
            if (SettingsService::set((string) $key, $value === null ? null : (string) $value, $request->userId())) {
                $saved[] = $key;
            } else {
                $unknown[] = $key;
            }
        }
        return Response::json(['saved' => $saved, 'unknown' => $unknown, 'settings' => SettingsService::allGrouped()]);
    }

    /** Audyt: kto, kiedy, stara i nowa wartość. ?key=&limit= */
    public function audit(Request $request): Response
    {
        $limit = min(500, max(10, (int) ($request->query['limit'] ?? 100)));
        $where = '1=1';
        $params = [];
        if (!empty($request->query['key'])) {
            $where = 'a.setting_key = ?';
            $params[] = $request->query['key'];
        }
        return Response::json(Database::select(
            "SELECT a.*, u.first_name, u.last_name, u.email
             FROM settings_audit a
             LEFT JOIN users u ON u.id = a.changed_by
             WHERE $where
             ORDER BY a.created_at DESC
             LIMIT $limit",
            $params
        ));
    }
}
