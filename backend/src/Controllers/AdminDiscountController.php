<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

/** CRM: kody rabatowe — kwotowe/procentowe, data ważności, limit użyć. */
class AdminDiscountController
{
    public function index(Request $request): Response
    {
        return Response::json(Database::select('SELECT * FROM discount_codes ORDER BY created_at DESC'));
    }

    public function store(Request $request): Response
    {
        $code = strtoupper(trim((string) $request->input('code', '')));
        $type = (string) $request->input('type', '');
        $value = $request->input('value');
        if ($code === '' || !in_array($type, ['amount', 'percent'], true) || !is_numeric($value)) {
            return Response::error('Kod, typ (kwotowy/procentowy) i wartość są wymagane', 422);
        }
        if ($type === 'percent' && ((float) $value <= 0 || (float) $value > 100)) {
            return Response::error('Rabat procentowy musi być w zakresie 1–100', 422);
        }
        if (Database::selectOne('SELECT id FROM discount_codes WHERE code = ?', [$code])) {
            return Response::error('Taki kod już istnieje', 409);
        }
        $id = Database::insert('discount_codes', [
            'code' => $code,
            'type' => $type,
            'value' => $value,
            'valid_from' => $request->input('valid_from'),
            'valid_until' => $request->input('valid_until'),
            'usage_limit' => $request->input('usage_limit'),
            'is_active' => (int) (bool) $request->input('is_active', true),
        ]);
        return Response::json(Database::selectOne('SELECT * FROM discount_codes WHERE id = ?', [$id]), 201);
    }

    public function update(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $fields = array_intersect_key($request->all(), array_flip([
            'type', 'value', 'valid_from', 'valid_until', 'usage_limit', 'is_active',
        ]));
        if ($fields) {
            Database::update('discount_codes', $fields, 'id = ?', [$id]);
        }
        return Response::json(Database::selectOne('SELECT * FROM discount_codes WHERE id = ?', [$id]));
    }

    public function destroy(Request $request): Response
    {
        $id = (int) $request->params['id'];
        if (Database::selectOne('SELECT id FROM bookings WHERE discount_code_id = ? LIMIT 1', [$id])) {
            Database::update('discount_codes', ['is_active' => 0], 'id = ?', [$id]);
            return Response::json(['ok' => true, 'deactivated' => true]);
        }
        Database::execute('DELETE FROM discount_codes WHERE id = ?', [$id]);
        return Response::json(['ok' => true, 'deleted' => true]);
    }
}
