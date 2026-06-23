<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;

/** CRM: urlopy / blokady terminów (pojedynczy dzień lub przedział) z komentarzem dla klienta. */
class AdminBlackoutController
{
    public function index(Request $request): Response
    {
        return Response::json(Database::select(
            'SELECT b.*, u.first_name, u.last_name
             FROM blackout_dates b LEFT JOIN users u ON u.id = b.created_by
             ORDER BY b.start_date DESC'
        ));
    }

    public function store(Request $request): Response
    {
        $start = (string) $request->input('start_date', '');
        $end = (string) ($request->input('end_date') ?: $start); // brak końca = jeden dzień
        $v = Validator::make(['start_date' => $start, 'end_date' => $end], [
            'start_date' => 'required|date',
            'end_date' => 'required|date',
        ]);
        if ($v->fails()) {
            return Response::error('Podaj prawidłowe daty', 422, $v->errors());
        }
        if ($end < $start) {
            return Response::error('Data końcowa nie może być wcześniejsza niż początkowa', 422);
        }
        $id = Database::insert('blackout_dates', [
            'start_date' => $start,
            'end_date' => $end,
            'comment' => $request->input('comment') ?: null,
            'created_by' => $request->userId(),
        ]);
        return Response::json(Database::selectOne('SELECT * FROM blackout_dates WHERE id = ?', [$id]), 201);
    }

    public function destroy(Request $request): Response
    {
        Database::execute('DELETE FROM blackout_dates WHERE id = ?', [(int) $request->params['id']]);
        return Response::json(['ok' => true]);
    }
}
