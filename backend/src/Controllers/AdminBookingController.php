<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\ActivityLog;
use App\Services\BookingService;
use App\Services\GoogleCalendarService;
use App\Services\MailerService;
use App\Services\SettingsService;

/** CRM: zarządzanie rezerwacjami — lista/kalendarz, karta, statusy, zadatek, umowy, galeria. */
class AdminBookingController
{
    /** Lista z filtrami: ?status=&from=&to=&q= (kalendarz używa from/to). */
    public function index(Request $request): Response
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($request->query['status'])) {
            $where[] = 'b.status = ?';
            $params[] = $request->query['status'];
        }
        if (!empty($request->query['from'])) {
            $where[] = 'b.event_date >= ?';
            $params[] = $request->query['from'];
        }
        if (!empty($request->query['to'])) {
            $where[] = 'b.event_date <= ?';
            $params[] = $request->query['to'];
        }
        if (!empty($request->query['q'])) {
            $where[] = '(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR b.venue_address LIKE ?)';
            $like = '%' . $request->query['q'] . '%';
            array_push($params, $like, $like, $like, $like);
        }
        $dir = ($request->query['sort'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC'; // od najstarszego / najmłodszego
        $bookings = Database::select(
            'SELECT b.id, b.event_date, b.start_time, b.duration_hours, b.status, b.requires_manual_confirmation,
                    b.venue_name, b.venue_address, b.distance_km, b.total_price, b.deposit_amount,
                    p.name AS package_name, u.first_name, u.last_name, u.email, u.phone
             FROM bookings b
             JOIN users u ON u.id = b.user_id
             JOIN packages p ON p.id = b.package_id
             WHERE ' . implode(' AND ', $where) . "
             ORDER BY b.event_date $dir, b.start_time $dir
             LIMIT 500",
            $params
        );
        foreach ($bookings as &$booking) {
            $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        }
        return Response::json($bookings);
    }

    public function show(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = Database::selectOne(
            'SELECT b.*, p.name AS package_name, u.first_name, u.last_name, u.email, u.phone,
                    cp.type AS client_type, cp.street, cp.house_no, cp.apartment_no, cp.postal_code, cp.city,
                    cp.country, cp.company_name, cp.nip, cp.company_address, cp.representative, cp.notes AS profile_notes
             FROM bookings b
             JOIN users u ON u.id = b.user_id
             LEFT JOIN client_profiles cp ON cp.user_id = u.id
             JOIN packages p ON p.id = b.package_id
             WHERE b.id = ?',
            [$id]
        );
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        $booking['checklist'] = BookingService::checklist($id);
        $booking['history'] = Database::select(
            'SELECT h.*, u.first_name, u.last_name FROM booking_status_history h
             LEFT JOIN users u ON u.id = h.changed_by
             WHERE h.booking_id = ? ORDER BY h.created_at DESC',
            [$id]
        );
        $booking['payments'] = Database::select('SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC', [$id]);
        $booking['contracts'] = Database::select('SELECT * FROM contracts WHERE booking_id = ? ORDER BY id DESC', [$id]);
        $paid = BookingService::paidSummary($id, (float) $booking['total_price']);
        $booking['paid_amount'] = $paid['paid'];
        $booking['remaining_amount'] = $paid['remaining'];
        return Response::json($booking);
    }

    /**
     * Dodatkowa wpłata (np. dopłata reszty po zadatku). Rejestruje opłaconą płatność;
     * podsumowanie „łącznie zapłacono / pozostało" liczy się ze wszystkich wpłat.
     */
    public function addPayment(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $amount = $request->input('amount');
        if (!is_numeric($amount) || (float) $amount <= 0) {
            return Response::error('Podaj prawidłową kwotę wpłaty', 422);
        }
        $type = (string) $request->input('type', 'final');
        if (!in_array($type, ['deposit', 'final', 'other'], true)) {
            $type = 'final';
        }
        Database::insert('payments', [
            'booking_id' => $id, 'type' => $type, 'method' => 'transfer',
            'amount' => round((float) $amount, 2), 'status' => 'paid',
            'paid_at' => date('Y-m-d H:i:s'), 'marked_by' => $request->userId(),
        ]);
        $label = ['deposit' => 'Zadatek', 'final' => 'Dopłata', 'other' => 'Wpłata'][$type];
        Database::insert('booking_status_history', [
            'booking_id' => $id,
            'old_status' => $booking['status'],
            'new_status' => $booking['status'],
            'changed_by' => $request->userId(),
            'note' => sprintf('%s: %s zł (przelew)', $label, number_format(round((float) $amount, 2), 2, ',', ' ')),
        ]);
        ActivityLog::record('admin_payment_added', ['user_id' => $request->userId(), 'booking_id' => $id, 'ip' => BookingController::clientIp(), 'detail' => sprintf('%s %s zł (przelew)', $label, number_format(round((float) $amount, 2), 2, ',', ' '))]);
        return $this->show($request);
    }

    /** Usunięcie/odznaczenie pojedynczej wpłaty (korekta pomyłki). */
    public function deletePayment(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $paymentId = (int) $request->params['paymentId'];
        $payment = Database::selectOne('SELECT * FROM payments WHERE id = ? AND booking_id = ?', [$paymentId, $id]);
        if ($payment === null) {
            return Response::notFound('Wpłata nie istnieje');
        }
        Database::execute('DELETE FROM payments WHERE id = ?', [$paymentId]);
        $status = (string) BookingService::find($id)['status'];
        Database::insert('booking_status_history', [
            'booking_id' => $id,
            'old_status' => $status,
            'new_status' => $status,
            'changed_by' => $request->userId(),
            'note' => sprintf('Usunięto wpłatę %s zł', number_format((float) $payment['amount'], 2, ',', ' ')),
        ]);
        ActivityLog::record('admin_payment_deleted', ['user_id' => $request->userId(), 'booking_id' => $id, 'ip' => BookingController::clientIp(), 'detail' => sprintf('usunięto wpłatę %s zł', number_format((float) $payment['amount'], 2, ',', ' '))]);
        return $this->show($request);
    }

    /**
     * Pełna edycja rezerwacji (CRM ma pełną kontrolę): termin, godzina, pakiet, lokalizacja,
     * ceny (pakiet/transport/księga/rabat), księga gości, typ imprezy, notatki.
     * Drag&drop w kalendarzu używa tego samego endpointu (event_date + start_time).
     * Suma i zadatek przeliczane automatycznie, chyba że admin poda je jawnie.
     */
    public function update(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $v = Validator::make($request->all(), [
            'event_date' => 'date',
            'start_time' => 'time',
            'guestbook' => 'in:none,standard,personalized',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane', 422, $v->errors());
        }
        $fields = array_intersect_key($request->all(), array_flip([
            'event_date', 'start_time', 'duration_hours', 'package_id',
            'venue_name', 'venue_address', 'venue_place_id', 'distance_km', 'travel_time_min',
            'event_type', 'guests_count',
            'package_price', 'free_km', 'km_rate', 'transport_cost',
            'guestbook', 'guestbook_price', 'discount_amount',
            'total_price', 'deposit_percent', 'deposit_amount',
            'admin_notes', 'client_notes', 'gallery_link', 'ask_review',
        ]));
        if (isset($fields['start_time'])) {
            $fields['start_time'] .= ':00';
        }

        // Zmiana pakietu: czas trwania z nowego pakietu (o ile nie podano jawnie)
        if (isset($fields['package_id'])) {
            $package = Database::selectOne('SELECT * FROM packages WHERE id = ?', [$fields['package_id']]);
            if ($package === null) {
                return Response::error('Wybrany pakiet nie istnieje', 422);
            }
            if (!isset($fields['duration_hours'])) {
                $fields['duration_hours'] = $package['duration_hours'];
            }
        }

        if ($fields) {
            Database::update('bookings', $fields, 'id = ?', [$id]);
        }

        // Przeliczenie sumy i zadatku po zmianie składników ceny (chyba że podane jawnie)
        $priceComponents = ['package_price', 'free_km', 'km_rate', 'distance_km', 'transport_cost', 'guestbook_price', 'discount_amount', 'deposit_percent'];
        $priceTouched = array_intersect_key($fields, array_flip($priceComponents)) !== [];
        if ($priceTouched || isset($fields['total_price'])) {
            $row = Database::selectOne('SELECT * FROM bookings WHERE id = ?', [$id]);
            $total = isset($fields['total_price'])
                ? (float) $fields['total_price']
                : round((float) $row['package_price'] + (float) $row['transport_cost'] + (float) $row['guestbook_price'] - (float) $row['discount_amount'], 2);
            $deposit = isset($fields['deposit_amount'])
                ? (float) $fields['deposit_amount']
                : round($total * (float) $row['deposit_percent'] / 100, 2);
            Database::update('bookings', ['total_price' => $total, 'deposit_amount' => $deposit], 'id = ?', [$id]);
        }

        $updated = BookingService::find($id);
        try {
            GoogleCalendarService::syncBooking($updated);
        } catch (\Throwable $e) {
            error_log('Calendar sync: ' . $e->getMessage());
        }
        $updated['status_label'] = BookingService::STATUSES[$updated['status']];
        return Response::json($updated);
    }

    /** Edycja danych klienta z poziomu karty rezerwacji (konto + profil). */
    public function updateClient(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $v = Validator::make($request->all(), [
            'email' => 'email', 'phone' => 'phone', 'postal_code' => 'postal_code', 'nip' => 'nip',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane klienta', 422, $v->errors());
        }
        $userId = (int) $booking['user_id'];

        $userFields = array_intersect_key($request->all(), array_flip(['first_name', 'last_name', 'phone', 'email']));
        if (isset($userFields['email'])) {
            $userFields['email'] = strtolower(trim((string) $userFields['email']));
            $existing = Database::selectOne('SELECT id FROM users WHERE email = ? AND id != ?', [$userFields['email'], $userId]);
            if ($existing !== null) {
                return Response::error('Inne konto używa już tego adresu e-mail', 409);
            }
        }
        if ($userFields) {
            Database::update('users', $userFields, 'id = ?', [$userId]);
        }
        $profileFields = array_intersect_key($request->all(), array_flip([
            'type', 'street', 'house_no', 'apartment_no', 'postal_code', 'city', 'country',
            'company_name', 'nip', 'company_address', 'representative', 'notes',
        ]));
        if ($profileFields) {
            Database::update('client_profiles', $profileFields, 'user_id = ?', [$userId]);
        }
        return $this->show($request);
    }

    public function changeStatus(Request $request): Response
    {
        $newStatus = (string) $request->input('status', '');
        if (!isset(BookingService::STATUSES[$newStatus])) {
            return Response::error('Nieznany status', 422);
        }
        $booking = BookingService::changeStatus(
            (int) $request->params['id'],
            $newStatus,
            $request->userId(),
            $request->input('note')
        );
        $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        ActivityLog::record('admin_status_change', ['user_id' => $request->userId(), 'booking_id' => (int) $request->params['id'], 'ip' => BookingController::clientIp(), 'detail' => 'status → ' . ($booking['status_label'] ?? $newStatus)]);
        return Response::json($booking);
    }

    /**
     * „Zadatek wpłacony" — admin może podać RZECZYWIŚCIE wpłaconą kwotę (bywa inna niż
     * wyliczony zadatek). Zapis płatności + automatyczny e-mail + status: Rezerwacja potwierdzona.
     */
    public function markDepositPaid(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $amount = $request->input('amount');
        $amount = is_numeric($amount) && (float) $amount > 0 ? round((float) $amount, 2) : (float) $booking['deposit_amount'];

        $pending = Database::selectOne(
            "SELECT id FROM payments WHERE booking_id = ? AND type = 'deposit' AND status = 'pending' ORDER BY id DESC LIMIT 1",
            [$id]
        );
        if ($pending !== null) {
            Database::update('payments', [
                'status' => 'paid', 'amount' => $amount,
                'paid_at' => date('Y-m-d H:i:s'), 'marked_by' => $request->userId(),
            ], 'id = ?', [$pending['id']]);
        } else {
            Database::insert('payments', [
                'booking_id' => $id, 'type' => 'deposit', 'method' => 'transfer',
                'amount' => $amount, 'status' => 'paid',
                'paid_at' => date('Y-m-d H:i:s'), 'marked_by' => $request->userId(),
            ]);
        }
        $note = sprintf('Zadatek wpłacony: %s zł (przelew)', number_format($amount, 2, ',', ' '));
        $booking = BookingService::changeStatus($id, 'confirmed', $request->userId(), $note);
        $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        ActivityLog::record('admin_deposit_paid', ['user_id' => $request->userId(), 'booking_id' => $id, 'ip' => BookingController::clientIp(), 'detail' => sprintf('zadatek %s zł oznaczony jako wpłacony', number_format($amount, 2, ',', ' '))]);
        return Response::json($booking);
    }

    /**
     * Cofnięcie oznaczenia zadatku (np. omyłkowe kliknięcie) — płatność wraca do „pending",
     * status do „Oczekuje na zadatek". Bez wysyłki e-maili (cicha korekta).
     */
    public function unmarkDeposit(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $paid = Database::selectOne(
            "SELECT id FROM payments WHERE booking_id = ? AND type = 'deposit' AND status = 'paid' ORDER BY id DESC LIMIT 1",
            [$id]
        );
        if ($paid === null) {
            return Response::error('Brak oznaczonej wpłaty zadatku do cofnięcia', 409);
        }
        Database::update('payments', ['status' => 'pending', 'paid_at' => null], 'id = ?', [$paid['id']]);
        // Zmiana statusu bezpośrednio (bez changeStatus), aby NIE wysyłać ponownie e-maila o zadatku.
        Database::update('bookings', ['status' => 'awaiting_deposit'], 'id = ?', [$id]);
        Database::insert('booking_status_history', [
            'booking_id' => $id,
            'old_status' => $booking['status'],
            'new_status' => 'awaiting_deposit',
            'changed_by' => $request->userId(),
            'note' => 'Cofnięto oznaczenie wpłaty zadatku',
        ]);
        $booking = BookingService::find($id);
        $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        ActivityLog::record('admin_deposit_unpaid', ['user_id' => $request->userId(), 'booking_id' => $id, 'ip' => BookingController::clientIp(), 'detail' => 'cofnięto oznaczenie zadatku']);
        return Response::json($booking);
    }

    /**
     * Ręczne odblokowanie / ponowne zablokowanie personalizacji dla konkretnej rezerwacji.
     * Pozwala klientowi edytować personalizację mimo blokady terminowej (N dni przed imprezą
     * lub automatycznej blokady z crona). Body: { unlocked: true|false }.
     */
    public function setPersonalizationUnlock(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $unlocked = (bool) $request->input('unlocked', true);
        Database::update(
            'bookings',
            ['personalization_unlocked_at' => $unlocked ? date('Y-m-d H:i:s') : null],
            'id = ?',
            [$id]
        );
        Database::insert('booking_status_history', [
            'booking_id' => $id,
            'old_status' => $booking['status'],
            'new_status' => $booking['status'],
            'changed_by' => $request->userId(),
            'note' => $unlocked
                ? 'Personalizacja odblokowana ręcznie (mimo blokady terminowej)'
                : 'Personalizacja ponownie zablokowana',
        ]);
        $updated = BookingService::find($id);
        $updated['status_label'] = BookingService::STATUSES[$updated['status']];
        return Response::json($updated);
    }

    /** Galeria: admin wkleja link Google Drive + checkbox „Wysyłaj prośbę o opinię". */
    public function sendGallery(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $link = trim((string) $request->input('gallery_link', ''));
        if ($link === '') {
            return Response::error('Podaj link do galerii', 422);
        }
        $askReview = (bool) $request->input('ask_review', false);

        $reviewFragment = '';
        if ($askReview) {
            $template = Database::selectOne("SELECT body FROM email_templates WHERE code = 'review_request'", []);
            $reviewFragment = MailerService::render($template['body'] ?? '', [
                'link_opinii' => (string) $request->input('review_link', SettingsService::get('company.website', '')),
            ]);
        }
        $vars = MailerService::bookingVars($booking, $booking) + [
            'link_galerii' => $link,
            'prosba_o_opinie' => $reviewFragment,
        ];
        MailerService::queueEmail('gallery_ready', $booking['email'], $booking['first_name'], $vars, $id);
        Database::update('bookings', [
            'gallery_link' => $link,
            'gallery_sent_at' => date('Y-m-d H:i:s'),
            'ask_review' => $askReview ? 1 : 0,
        ], 'id = ?', [$id]);
        ActivityLog::record('admin_gallery_sent', ['user_id' => $request->userId(), 'email' => $booking['email'] ?? null, 'booking_id' => $id, 'ip' => BookingController::clientIp(), 'detail' => 'wysłano galerię' . ($askReview ? ' + prośba o opinię' : '')]);
        return Response::json(['ok' => true]);
    }

    /** Usunięcie rezerwacji (po potwierdzeniu w CRM) + e-mail do klienta. Kasowanie kaskadowe. */
    public function destroy(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $booking = BookingService::find($id);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        // E-mail do klienta zanim usuniemy rekord (kolejka przetrwa — booking_id → NULL).
        MailerService::queueEmail(
            'booking_deleted',
            $booking['email'],
            $booking['first_name'],
            MailerService::bookingVars($booking, $booking),
            $id
        );
        ActivityLog::record('admin_booking_deleted', ['user_id' => $request->userId(), 'email' => $booking['email'] ?? null, 'booking_id' => $id, 'ip' => BookingController::clientIp(), 'detail' => 'usunięto rezerwację (' . ($booking['event_date'] ?? '') . ')']);
        // FK przy bookings: CASCADE (personalizacje, umowy, płatności, historia, czat) / SET NULL (oferty, kolejki).
        Database::execute('DELETE FROM bookings WHERE id = ?', [$id]);
        return Response::json(['ok' => true]);
    }

    /** Lista statusów dla UI. */
    public function statuses(Request $request): Response
    {
        $out = [];
        foreach (BookingService::STATUSES as $code => $label) {
            $out[] = ['code' => $code, 'label' => $label];
        }
        return Response::json($out);
    }
}
