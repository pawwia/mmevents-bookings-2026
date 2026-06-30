<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\ActivityLog;
use App\Services\BookingService;
use App\Services\ContractService;
use App\Services\MailerService;
use App\Services\PricingService;
use App\Services\SettingsService;

/**
 * Oferty wystawiane ręcznie w CRM: admin podaje dane imprezy i klienta (NIP → GUS),
 * buduje warianty cenowe (pakiet bazowy + elementy stockowe + własne udogodnienia),
 * a klient na interaktywnej stronie /oferta/{token} wybiera wariant → powstaje rezerwacja.
 */
class OfferController
{
    private const OFFER_FIELDS = [
        'client_name', 'email', 'phone', 'nip', 'company_name', 'event_type', 'guests_count',
        'event_date', 'start_time', 'venue_name', 'venue_address', 'distance_km',
        'travel_time_min', 'intro', 'valid_until', 'status',
    ];

    // ---------- CRM (admin) ----------

    public function index(Request $request): Response
    {
        $offers = Database::select(
            'SELECT o.*, u.first_name AS admin_first_name, u.last_name AS admin_last_name
             FROM offers o LEFT JOIN users u ON u.id = o.created_by
             ORDER BY o.created_at DESC LIMIT 200'
        );
        $variants = Database::select('SELECT * FROM offer_variants ORDER BY sort_order, id');
        $byOffer = [];
        foreach ($variants as $variant) {
            $variant['items'] = json_decode((string) $variant['items'], true) ?: [];
            $byOffer[(int) $variant['offer_id']][] = $variant;
        }
        foreach ($offers as &$offer) {
            $offer['variants'] = $byOffer[(int) $offer['id']] ?? [];
        }
        return Response::json($offers);
    }

    public function store(Request $request): Response
    {
        $v = Validator::make($request->all(), [
            'client_name' => 'required|max:150',
            'email' => 'email',
            'event_date' => 'date',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane oferty', 422, $v->errors());
        }
        $fields = array_intersect_key($request->all(), array_flip(self::OFFER_FIELDS));
        unset($fields['status']);
        $offerId = Database::insert('offers', $fields + [
            'token' => bin2hex(random_bytes(16)),
            'created_by' => $request->userId(),
        ]);
        $this->syncVariants($offerId, (array) $request->input('variants', []));
        return Response::json($this->findForAdmin($offerId), 201);
    }

    public function update(Request $request): Response
    {
        $offerId = (int) $request->params['id'];
        if (Database::selectOne('SELECT id FROM offers WHERE id = ?', [$offerId]) === null) {
            return Response::notFound('Oferta nie istnieje');
        }
        $fields = array_intersect_key($request->all(), array_flip(self::OFFER_FIELDS));
        if ($fields) {
            Database::update('offers', $fields, 'id = ?', [$offerId]);
        }
        if ($request->input('variants') !== null) {
            $this->syncVariants($offerId, (array) $request->input('variants'));
        }
        return Response::json($this->findForAdmin($offerId));
    }

    public function destroy(Request $request): Response
    {
        Database::execute('DELETE FROM offers WHERE id = ? AND booking_id IS NULL', [(int) $request->params['id']]);
        return Response::json(['ok' => true]);
    }

    /** Wysyłka oferty e-mailem do klienta (szablon offer_ready) + status „sent". */
    public function send(Request $request): Response
    {
        $offer = Database::selectOne('SELECT * FROM offers WHERE id = ?', [(int) $request->params['id']]);
        if ($offer === null) {
            return Response::notFound('Oferta nie istnieje');
        }
        if (empty($offer['email'])) {
            return Response::error('Oferta nie ma adresu e-mail klienta', 422);
        }
        $link = SettingsService::frontendUrl() . '/oferta/' . $offer['token'];
        MailerService::queueEmail('offer_ready', $offer['email'], $offer['client_name'], [
            'imie' => explode(' ', trim($offer['client_name']))[0],
            'data_imprezy' => $offer['event_date'] ? date('d.m.Y', strtotime($offer['event_date'])) : 'do ustalenia',
            'link_oferty' => $link,
            'wazna_do' => $offer['valid_until'] ? date('d.m.Y', strtotime($offer['valid_until'])) : 'odwołania',
        ]);
        Database::update('offers', ['status' => 'sent'], 'id = ?', [$offer['id']]);
        return Response::json(['ok' => true, 'link' => $link]);
    }

    // ---------- Publiczne (klient) ----------

    /** Interaktywna strona oferty — dane bez pól administracyjnych. */
    public function show(Request $request): Response
    {
        $offer = Database::selectOne('SELECT * FROM offers WHERE token = ?', [$request->params['token']]);
        if ($offer === null) {
            return Response::notFound('Oferta nie istnieje lub została wycofana');
        }
        $expired = $offer['valid_until'] !== null && $offer['valid_until'] < date('Y-m-d');
        $variants = Database::select(
            'SELECT id, name, price, duration_hours, items, description, sort_order
             FROM offer_variants WHERE offer_id = ? ORDER BY sort_order, id',
            [$offer['id']]
        );
        foreach ($variants as &$variant) {
            $variant['items'] = json_decode((string) $variant['items'], true) ?: [];
        }
        return Response::json([
            'client_name' => $offer['client_name'],
            'company_name' => $offer['company_name'],
            'event_type' => $offer['event_type'],
            'guests_count' => $offer['guests_count'],
            'event_date' => $offer['event_date'],
            'start_time' => $offer['start_time'],
            'venue_name' => $offer['venue_name'],
            'venue_address' => $offer['venue_address'],
            'intro' => $offer['intro'],
            'valid_until' => $offer['valid_until'],
            'status' => $offer['status'],
            'expired' => $expired,
            'accepted_variant_id' => $offer['accepted_variant_id'] ? (int) $offer['accepted_variant_id'] : null,
            'variants' => $variants,
        ]);
    }

    /**
     * Akceptacja wariantu: klient podaje dane niezbędne do umowy → powstaje rezerwacja
     * (cena = cena wariantu, transport wliczony w ofertę) + umowa + e-mail.
     */
    public function accept(Request $request): Response
    {
        $offer = Database::selectOne('SELECT * FROM offers WHERE token = ?', [$request->params['token']]);
        if ($offer === null) {
            return Response::notFound('Oferta nie istnieje');
        }
        if ($offer['status'] === 'accepted' || $offer['booking_id'] !== null) {
            return Response::error('Ta oferta została już zaakceptowana', 409);
        }
        if ($offer['valid_until'] !== null && $offer['valid_until'] < date('Y-m-d')) {
            return Response::error('Oferta wygasła — skontaktuj się z nami po nową wycenę', 410);
        }
        $v = Validator::make($request->all(), [
            'variant_id' => 'required|int',
            'first_name' => 'required|max:100',
            'last_name' => 'required|max:100',
            'phone' => 'required|phone',
        ]);
        if ($v->fails()) {
            return Response::error('Uzupełnij wymagane dane', 422, $v->errors());
        }
        if (!(bool) $request->input('terms_accepted', false)) {
            return Response::error('Wymagana akceptacja polityki prywatności i regulaminu', 422);
        }

        // Dane imprezy: zawsze priorytet mają wartości z oferty (jeśli admin je podał,
        // klient ich nie wpisuje). Klient uzupełnia tylko to, czego w ofercie brakuje.
        $eventDate = !empty($offer['event_date']) ? (string) $offer['event_date'] : trim((string) $request->input('event_date', ''));
        $startTime = !empty($offer['start_time']) ? (string) $offer['start_time'] : trim((string) $request->input('start_time', ''));
        // Lokalizacja jest „w ofercie", jeśli wypełniono dowolne z pól (nazwa obiektu LUB adres).
        $offerHasVenue = !empty($offer['venue_name']) || !empty($offer['venue_address']);
        $venueName = $offerHasVenue ? $offer['venue_name'] : $request->input('venue_name');
        $venueAddress = $offerHasVenue ? (string) ($offer['venue_address'] ?? '') : trim((string) $request->input('venue_address', ''));

        $ev = Validator::make(
            ['event_date' => $eventDate, 'start_time' => substr($startTime, 0, 5)],
            ['event_date' => 'required|date', 'start_time' => 'required|time']
        );
        if ($ev->fails()) {
            return Response::error('Uzupełnij dane imprezy (data i godzina)', 422, $ev->errors());
        }
        if (trim((string) $venueName) === '' && trim($venueAddress) === '') {
            return Response::error('Uzupełnij miejsce imprezy', 422);
        }
        if (strlen($startTime) === 5) {
            $startTime .= ':00'; // ręcznie wpisana godzina "HH:MM" → pełny czas
        }

        $variant = Database::selectOne(
            'SELECT * FROM offer_variants WHERE id = ? AND offer_id = ?',
            [(int) $request->input('variant_id'), $offer['id']]
        );
        if ($variant === null) {
            return Response::error('Wybrany wariant nie istnieje', 422);
        }

        // Klient jest już zalogowany (logowanie / rejestracja e-mail+hasło / Google odbywa się
        // na stronie oferty przed akceptacją — jak w onboardingu).
        $user = Database::selectOne('SELECT * FROM users WHERE id = ?', [$request->userId()]);
        if ($user === null) {
            return Response::error('Wymagane zalogowanie', 401);
        }
        // Imię, nazwisko i telefon z formularza (np. świeżo założone konto może ich nie mieć).
        $userFields = array_filter(
            array_intersect_key($request->all(), array_flip(['first_name', 'last_name', 'phone'])),
            static fn ($value) => $value !== null && $value !== ''
        );
        if ($userFields) {
            Database::update('users', $userFields, 'id = ?', [$user['id']]);
        }
        // Profil mógł nie powstać (np. konto z Google) — utwórz, zanim zapiszemy dane do faktury.
        if (Database::selectOne('SELECT user_id FROM client_profiles WHERE user_id = ?', [$user['id']]) === null) {
            Database::insert('client_profiles', ['user_id' => $user['id']]);
        }
        $profileFields = array_intersect_key($request->all(), array_flip([
            'type', 'street', 'house_no', 'apartment_no', 'postal_code', 'city', 'country',
            'company_name', 'nip', 'company_address', 'representative',
        ]));
        if ($profileFields) {
            Database::update('client_profiles', $profileFields, 'user_id = ?', [$user['id']]);
        }
        $user = Database::selectOne('SELECT * FROM users WHERE id = ?', [$user['id']]);

        // Pakiet bazowy wariantu (czas trwania + wymagany snapshot cennika)
        $package = $variant['package_id']
            ? Database::selectOne('SELECT * FROM packages WHERE id = ?', [$variant['package_id']])
            : Database::selectOne('SELECT * FROM packages WHERE is_active = 1 ORDER BY sort_order LIMIT 1');
        if ($package === null) {
            return Response::error('Brak pakietu bazowego — skontaktuj się z nami', 422);
        }
        $year = (int) substr($eventDate, 0, 4);
        $priceRow = PricingService::priceForYear((int) $package['id'], $year)
            ?? Database::selectOne('SELECT * FROM package_prices WHERE package_id = ? ORDER BY year DESC LIMIT 1', [$package['id']]);
        if ($priceRow === null) {
            return Response::error('Brak cennika pakietu bazowego — skontaktuj się z nami', 422);
        }
        $attraction = Database::selectOne(
            'SELECT id FROM attractions WHERE attraction_type_id = ? AND is_active = 1 ORDER BY id LIMIT 1',
            [$package['attraction_type_id']]
        );

        $price = (float) $variant['price'];
        $depositPercent = SettingsService::float('finance.deposit_percent', 30.0);

        $bookingId = Database::insert('bookings', [
            'user_id' => (int) $user['id'],
            'attraction_id' => (int) $attraction['id'],
            'offer_id' => (int) $offer['id'],
            'package_id' => (int) $package['id'],
            'package_price_id' => (int) $priceRow['id'],
            'event_date' => $eventDate,
            'start_time' => $startTime,
            'duration_hours' => $variant['duration_hours'] ?? $package['duration_hours'],
            'event_type' => $offer['event_type'],
            'guests_count' => $offer['guests_count'],
            'status' => 'awaiting_contract',
            'venue_name' => $venueName,
            'venue_address' => $venueAddress,
            'distance_km' => $offer['distance_km'],
            'travel_time_min' => $offer['travel_time_min'],
            'package_price' => $price,           // cena wariantu oferty (transport wliczony)
            'free_km' => 0,
            'transport_cost' => 0,
            'guestbook' => 'none',
            'total_price' => $price,
            'deposit_percent' => $depositPercent,
            'deposit_amount' => round($price * $depositPercent / 100, 2),
            'terms_accepted_at' => date('Y-m-d H:i:s'),
            'client_notes' => $request->input('client_notes'),
            'admin_notes' => sprintf('Z oferty #%d — wariant: %s', $offer['id'], $variant['name']),
        ]);
        Database::insert('booking_personalizations', ['booking_id' => $bookingId]);
        Database::insert('booking_status_history', [
            'booking_id' => $bookingId,
            'old_status' => null,
            'new_status' => 'awaiting_contract',
            'changed_by' => null,
            'note' => 'Akceptacja oferty (wariant: ' . $variant['name'] . ')',
        ]);
        Database::update('offers', [
            'status' => 'accepted',
            'accepted_variant_id' => (int) $variant['id'],
            'booking_id' => $bookingId,
        ], 'id = ?', [$offer['id']]);

        $booking = BookingService::find($bookingId);
        MailerService::queueEmail(
            'booking_created',
            $booking['email'],
            $booking['first_name'],
            MailerService::bookingVars($booking, $booking),
            $bookingId
        );
        try {
            ContractService::generate($bookingId);
        } catch (\Throwable $e) {
            error_log('Offer contract: ' . $e->getMessage());
        }

        // Powiadomienie właściciela o nowej rezerwacji (z akceptacji oferty)
        BookingService::notifyOwner($bookingId);

        ActivityLog::record('offer_accepted', ['user_id' => $request->userId(), 'booking_id' => $bookingId, 'ip' => BookingController::clientIp(), 'detail' => 'akceptacja oferty — ' . $price . ' zł']);

        return Response::json([
            'booking_id' => $bookingId,
            'deposit_amount' => round($price * $depositPercent / 100, 2),
            'total_price' => $price,
        ], 201);
    }

    // ---------- Pomocnicze ----------

    private function syncVariants(int $offerId, array $variants): void
    {
        Database::execute('DELETE FROM offer_variants WHERE offer_id = ?', [$offerId]);
        $sort = 0;
        foreach ($variants as $variant) {
            if (!is_array($variant) || trim((string) ($variant['name'] ?? '')) === '' || !is_numeric($variant['price'] ?? null)) {
                continue;
            }
            Database::insert('offer_variants', [
                'offer_id' => $offerId,
                'package_id' => !empty($variant['package_id']) ? (int) $variant['package_id'] : null,
                'name' => $variant['name'],
                'price' => $variant['price'],
                'duration_hours' => $variant['duration_hours'] ?? null,
                'items' => json_encode(array_values(array_filter((array) ($variant['items'] ?? []))), JSON_UNESCAPED_UNICODE),
                'description' => $variant['description'] ?? null,
                'sort_order' => $sort++,
            ]);
        }
    }

    private function findForAdmin(int $offerId): array
    {
        $offer = Database::selectOne('SELECT * FROM offers WHERE id = ?', [$offerId]);
        $offer['variants'] = array_map(static function (array $variant): array {
            $variant['items'] = json_decode((string) $variant['items'], true) ?: [];
            return $variant;
        }, Database::select('SELECT * FROM offer_variants WHERE offer_id = ? ORDER BY sort_order, id', [$offerId]));
        $offer['link'] = SettingsService::frontendUrl() . '/oferta/' . $offer['token'];
        return $offer;
    }
}
