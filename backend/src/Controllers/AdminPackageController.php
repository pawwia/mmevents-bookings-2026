<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

/**
 * CRM: pakiety + cennik per rok.
 * Administrator samodzielnie dodaje/wyłącza pakiety i ustawia ceny, darmowe km,
 * opisy i zawartość. Cennik można prowadzić tylko dla roku bieżącego oraz dwóch
 * kolejnych (np. w 2026: 2026, 2027, 2028) — dopiero wprowadzenie cennika otwiera
 * rezerwacje na dany rok.
 */
class AdminPackageController
{
    /** Liczba przyszłych lat (poza bieżącym), dla których można prowadzić cennik. */
    private const FUTURE_YEARS = 2;

    /** Najpóźniejszy rok, dla którego można dziś wprowadzić cennik. */
    private static function maxPriceYear(): int
    {
        return (int) date('Y') + self::FUTURE_YEARS;
    }

    public function index(Request $request): Response
    {
        $packages = Database::select(
            'SELECT p.*, at.name AS attraction_type FROM packages p
             JOIN attraction_types at ON at.id = p.attraction_type_id
             ORDER BY p.sort_order, p.id'
        );
        $prices = Database::select('SELECT * FROM package_prices ORDER BY year');
        $byPackage = [];
        foreach ($prices as $price) {
            $price['features'] = json_decode((string) $price['features'], true) ?: ['included' => [], 'excluded' => []];
            $byPackage[(int) $price['package_id']][] = $price;
        }
        foreach ($packages as &$package) {
            $package['prices'] = $byPackage[(int) $package['id']] ?? [];
        }
        return Response::json($packages);
    }

    public function store(Request $request): Response
    {
        if (trim((string) $request->input('name', '')) === '' || !$request->input('duration_hours')) {
            return Response::error('Nazwa i czas trwania są wymagane', 422);
        }
        $id = Database::insert('packages', [
            'attraction_type_id' => (int) $request->input('attraction_type_id', 1),
            'name' => $request->input('name'),
            'duration_hours' => $request->input('duration_hours'),
            'sort_order' => (int) $request->input('sort_order', 0),
            'is_active' => (int) (bool) $request->input('is_active', true),
        ]);
        return Response::json(Database::selectOne('SELECT * FROM packages WHERE id = ?', [$id]), 201);
    }

    public function update(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $fields = array_intersect_key($request->all(), array_flip([
            'name', 'duration_hours', 'sort_order', 'is_active', 'attraction_type_id',
        ]));
        if ($fields) {
            Database::update('packages', $fields, 'id = ?', [$id]);
        }
        return Response::json(Database::selectOne('SELECT * FROM packages WHERE id = ?', [$id]));
    }

    public function destroy(Request $request): Response
    {
        $id = (int) $request->params['id'];
        if (Database::selectOne('SELECT id FROM bookings WHERE package_id = ? LIMIT 1', [$id])) {
            // Pakiet z rezerwacjami tylko dezaktywujemy — snapshoty cen muszą zostać.
            Database::update('packages', ['is_active' => 0], 'id = ?', [$id]);
            return Response::json(['ok' => true, 'deactivated' => true]);
        }
        Database::execute('DELETE FROM packages WHERE id = ?', [$id]);
        return Response::json(['ok' => true, 'deleted' => true]);
    }

    /** Upsert cennika pakietu na dany rok. */
    public function upsertPrice(Request $request): Response
    {
        $packageId = (int) $request->params['id'];
        $year = (int) $request->input('year', 0);
        if (!is_numeric($request->input('price'))) {
            return Response::error('Podaj prawidłową cenę', 422);
        }
        if ($year < (int) date('Y') || $year > self::maxPriceYear()) {
            return Response::error(
                sprintf('Cennik można prowadzić tylko dla lat %d–%d', (int) date('Y'), self::maxPriceYear()),
                422
            );
        }
        $data = [
            'price' => $request->input('price'),
            'free_km' => (int) $request->input('free_km', 0),
            'description' => $request->input('description'),
            'features' => json_encode($request->input('features', ['included' => [], 'excluded' => []]), JSON_UNESCAPED_UNICODE),
            'guestbook_standard_price' => $request->input('guestbook_standard_price', 100),
            'guestbook_personalized_price' => $request->input('guestbook_personalized_price', 150),
            'is_active' => (int) (bool) $request->input('is_active', true),
        ];
        $existing = Database::selectOne(
            'SELECT id FROM package_prices WHERE package_id = ? AND year = ?', [$packageId, $year]
        );
        if ($existing !== null) {
            Database::update('package_prices', $data, 'id = ?', [$existing['id']]);
            $priceId = (int) $existing['id'];
        } else {
            $priceId = Database::insert('package_prices', $data + ['package_id' => $packageId, 'year' => $year]);
        }
        return Response::json(Database::selectOne('SELECT * FROM package_prices WHERE id = ?', [$priceId]));
    }

    /** Kopiuje cały cennik z roku źródłowego na nowy rok (start pracy nad nowym sezonem). */
    public function copyYear(Request $request): Response
    {
        $from = (int) $request->input('from_year', 0);
        $to = (int) $request->input('to_year', 0);
        if (!$from || !$to || $from === $to) {
            return Response::error('Podaj prawidłowe lata', 422);
        }
        if ($to < (int) date('Y') || $to > self::maxPriceYear()) {
            return Response::error(
                sprintf('Cennik można kopiować tylko na lata %d–%d', (int) date('Y'), self::maxPriceYear()),
                422
            );
        }
        $copied = 0;
        foreach (Database::select('SELECT * FROM package_prices WHERE year = ?', [$from]) as $price) {
            $exists = Database::selectOne(
                'SELECT id FROM package_prices WHERE package_id = ? AND year = ?', [$price['package_id'], $to]
            );
            if ($exists !== null) {
                continue;
            }
            unset($price['id']);
            $price['year'] = $to;
            Database::insert('package_prices', $price);
            $copied++;
        }
        return Response::json(['ok' => true, 'copied' => $copied]);
    }

    public function deletePrice(Request $request): Response
    {
        $priceId = (int) $request->params['priceId'];
        if (Database::selectOne('SELECT id FROM bookings WHERE package_price_id = ? LIMIT 1', [$priceId])) {
            Database::update('package_prices', ['is_active' => 0], 'id = ?', [$priceId]);
            return Response::json(['ok' => true, 'deactivated' => true]);
        }
        Database::execute('DELETE FROM package_prices WHERE id = ?', [$priceId]);
        return Response::json(['ok' => true, 'deleted' => true]);
    }
}
