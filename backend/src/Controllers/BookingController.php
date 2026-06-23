<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\AvailabilityService;
use App\Services\BookingService;
use App\Services\ContractService;
use App\Services\MailerService;
use App\Services\PricingService;
use App\Services\SettingsService;

/** Rezerwacje klienta: utworzenie (krok 8 onboardingu), lista, szczegóły, personalizacja. */
class BookingController
{
    /** Typy imprez objęte cennikiem standardowym (klienci indywidualni, do limitu osób). */
    private const STANDARD_EVENT_TYPES = ['wesele', 'urodziny'];

    /** Finalizacja onboardingu — tworzy rezerwację, aktualizuje profil, generuje umowę. */
    public function create(Request $request): Response
    {
        $v = Validator::make($request->all(), [
            'event_date' => 'required|date',
            'start_time' => 'required|time',
            'package_id' => 'required|int',
            'venue_address' => 'required|max:500',
            'distance_km' => 'required|numeric',
            'guestbook' => 'in:none,standard,personalized',
            'event_type' => 'required|max:40',
            'guests_count' => 'required|int',
            'first_name' => 'required|max:100',
            'last_name' => 'required|max:100',
            'phone' => 'required|phone',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane rezerwacji', 422, $v->errors());
        }
        if (!(bool) $request->input('terms_accepted', false)) {
            return Response::error('Wymagana akceptacja polityki prywatności i regulaminu', 422);
        }
        $eventDate = (string) $request->input('event_date');
        if ($eventDate < date('Y-m-d')) {
            return Response::error('Data nie może być z przeszłości', 422);
        }
        if (!PricingService::isYearBookable((int) substr($eventDate, 0, 4))) {
            return Response::error('Rezerwacje na wybrany rok nie są jeszcze dostępne (brak cennika)', 422);
        }
        $blackout = AvailabilityService::blackoutFor($eventDate);
        if ($blackout !== null) {
            return Response::error(
                ($blackout['comment'] ?? '') !== '' ? (string) $blackout['comment'] : 'Wybrany termin jest niedostępny. Prosimy o kontakt.',
                422
            );
        }

        // Dane do umowy muszą być kompletne — inaczej umowa miałaby puste pola („null null").
        $clientType = (string) $request->input('type', 'private');
        $requiredClient = $clientType === 'company'
            ? ['company_name' => 'nazwa firmy', 'nip' => 'NIP', 'company_address' => 'adres firmy', 'representative' => 'osoba reprezentująca']
            : ['street' => 'ulica', 'house_no' => 'numer domu', 'postal_code' => 'kod pocztowy', 'city' => 'miejscowość'];
        $missing = [];
        foreach ($requiredClient as $field => $label) {
            if (trim((string) $request->input($field, '')) === '') {
                $missing[] = $label;
            }
        }
        if ($missing !== []) {
            return Response::error('Uzupełnij dane do umowy: ' . implode(', ', $missing), 422);
        }

        // Wycena indywidualna: imprezy inne niż wesela/urodziny, powyżej limitu osób lub firmy.
        $eventType = mb_strtolower(trim((string) $request->input('event_type')));
        $guestsCount = (int) $request->input('guests_count');
        $maxGuests = SettingsService::int('booking.max_guests_standard', 200);
        $individualQuote = !in_array($eventType, self::STANDARD_EVENT_TYPES, true)
            || $guestsCount > $maxGuests
            || (string) $request->input('type', 'private') === 'company';

        $package = Database::selectOne(
            'SELECT p.*, at.id AS type_id FROM packages p
             JOIN attraction_types at ON at.id = p.attraction_type_id
             WHERE p.id = ? AND p.is_active = 1',
            [$request->input('package_id')]
        );
        if ($package === null) {
            return Response::error('Wybrany pakiet jest niedostępny', 422);
        }
        $attraction = Database::selectOne(
            'SELECT id FROM attractions WHERE attraction_type_id = ? AND is_active = 1 ORDER BY id LIMIT 1',
            [$package['type_id']]
        );
        if ($attraction === null) {
            return Response::error('Brak dostępnej atrakcji dla tego pakietu', 422);
        }

        // Profil klienta (krok 5) — zapis na koncie
        $profileFields = array_intersect_key($request->all(), array_flip([
            'type', 'street', 'house_no', 'apartment_no', 'postal_code', 'city', 'country',
            'company_name', 'nip', 'company_address', 'representative', 'notes',
        ]));
        if ($profileFields) {
            Database::update('client_profiles', $profileFields, 'user_id = ?', [$request->userId()]);
        }
        // Imię, nazwisko i telefon mogą pochodzić z kroku „Twoje dane" (konto założone
        // wcześniej tylko z e-mailem) — zapisujemy je na koncie użytkownika.
        $userFields = array_filter(
            array_intersect_key($request->all(), array_flip(['first_name', 'last_name', 'phone'])),
            static fn ($v) => $v !== null && $v !== ''
        );
        if ($userFields) {
            Database::update('users', $userFields, 'id = ?', [$request->userId()]);
        }

        // Wycena (snapshot)
        $quote = PricingService::quote(
            (int) $package['id'],
            $eventDate,
            (float) $request->input('distance_km'),
            (string) $request->input('guestbook', 'none'),
            $request->input('discount_code'),
        );
        if ($quote['discount_error'] !== null) {
            return Response::error($quote['discount_error'], 422);
        }

        // Kolizje: rezerwacja w zajętym dniu = zapytanie potwierdzane ręcznie
        $feasibility = AvailabilityService::checkFeasibility(
            $eventDate,
            (string) $request->input('start_time'),
            (float) $package['duration_hours'],
            (string) $request->input('venue_address'),
        );
        $hasOtherBookings = AvailabilityService::busyWindows($eventDate) !== [];
        $requiresManual = $hasOtherBookings || $individualQuote; // decyzja zawsze należy do administratora

        $bookingId = Database::insert('bookings', [
            'user_id' => $request->userId(),
            'attraction_id' => (int) $attraction['id'],
            'package_id' => (int) $package['id'],
            'package_price_id' => $quote['package_price_id'],
            'event_date' => $eventDate,
            'start_time' => $request->input('start_time') . ':00',
            'duration_hours' => $package['duration_hours'],
            'event_type' => $eventType,
            'guests_count' => $guestsCount,
            'status' => $requiresManual ? 'new' : 'awaiting_contract',
            'requires_manual_confirmation' => $requiresManual ? 1 : 0,
            'requires_individual_quote' => $individualQuote ? 1 : 0,
            'terms_accepted_at' => date('Y-m-d H:i:s'),
            'venue_name' => $request->input('venue_name'),
            'venue_address' => $request->input('venue_address'),
            'venue_place_id' => $request->input('venue_place_id'),
            'venue_lat' => $request->input('venue_lat'),
            'venue_lng' => $request->input('venue_lng'),
            'distance_km' => (float) $request->input('distance_km'),
            'travel_time_min' => (int) $request->input('travel_time_min', 0),
            'package_price' => $quote['package_price'],
            'free_km' => $quote['free_km'],
            'km_rate' => $quote['km_rate'],
            'transport_cost' => $quote['transport_cost'],
            'guestbook' => $quote['guestbook'],
            'guestbook_price' => $quote['guestbook_price'],
            'discount_code_id' => $quote['discount']['id'] ?? null,
            'discount_amount' => $quote['discount_amount'],
            'total_price' => $quote['total_price'],
            'deposit_percent' => $quote['deposit_percent'],
            'deposit_amount' => $quote['deposit_amount'],
            'client_notes' => $request->input('client_notes'),
            'created_ip' => self::clientIp(),
        ]);

        if ($quote['discount'] !== null) {
            Database::execute('UPDATE discount_codes SET used_count = used_count + 1 WHERE id = ?', [$quote['discount']['id']]);
        }
        Database::insert('booking_personalizations', ['booking_id' => $bookingId]);
        Database::insert('booking_status_history', [
            'booking_id' => $bookingId,
            'old_status' => null,
            'new_status' => $requiresManual ? 'new' : 'awaiting_contract',
            'changed_by' => $request->userId(),
            'note' => $requiresManual ? 'Zapytanie — termin częściowo zajęty' : 'Rezerwacja online',
        ]);

        $booking = BookingService::find($bookingId);
        // $booking zawiera świeże imię/nazwisko (z JOIN users), więc używamy go zamiast
        // $request->user, które mogło być wczytane przed zapisaniem danych z kroku „Twoje dane".
        $vars = MailerService::bookingVars($booking, $booking);

        $contract = null;
        if ($individualQuote) {
            // Wycena indywidualna (firmy, studniówki, plenerowe, bale, masowe, >limit osób)
            $vars['typ_imprezy'] = $eventType;
            $vars['liczba_osob'] = (string) $guestsCount;
            MailerService::queueEmail('individual_quote', $booking['email'], $booking['first_name'], $vars, $bookingId);
        } elseif ($requiresManual) {
            MailerService::queueEmail('booking_inquiry', $booking['email'], $booking['first_name'], $vars, $bookingId);
        } else {
            MailerService::queueEmail('booking_created', $booking['email'], $booking['first_name'], $vars, $bookingId);
            // Krok 8 onboardingu: wygenerowanie umowy
            try {
                $contract = ContractService::generate($bookingId);
            } catch (\Throwable $e) {
                error_log('Contract generate: ' . $e->getMessage());
            }
        }

        // Powiadomienie właściciela o nowej rezerwacji
        BookingService::notifyOwner($bookingId);

        return Response::json([
            'booking_id' => $bookingId,
            'status' => $booking['status'],
            'requires_manual_confirmation' => $requiresManual,
            'requires_individual_quote' => $individualQuote,
            'feasibility' => $feasibility,
            'contract' => $contract ? ['number' => $contract['number']] : null,
            'total_price' => $quote['total_price'],
            'deposit_amount' => $quote['deposit_amount'],
        ], 201);
    }

    /** Adres IP klienta (uwzględnia proxy LH.pl). */
    public static function clientIp(): string
    {
        $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if ($forwarded !== '') {
            return trim(explode(',', $forwarded)[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public function index(Request $request): Response
    {
        $bookings = Database::select(
            'SELECT b.id, b.event_date, b.start_time, b.duration_hours, b.status, b.venue_name, b.venue_address,
                    b.total_price, b.deposit_amount, b.gallery_link,
                    b.personalization_locked_at, b.personalization_unlocked_at, p.name AS package_name
             FROM bookings b JOIN packages p ON p.id = b.package_id
             WHERE b.user_id = ? ORDER BY b.event_date DESC',
            [$request->userId()]
        );
        foreach ($bookings as &$booking) {
            $booking['status_label'] = BookingService::STATUSES[$booking['status']];
            $booking['personalization_editable'] = $this->personalizationEditable($booking);
        }
        return Response::json($bookings);
    }

    public function show(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        $booking['status_label'] = BookingService::STATUSES[$booking['status']];
        $booking['personalization_editable'] = $this->personalizationEditable($booking);
        $booking['personalization'] = Database::selectOne(
            'SELECT animation_id, background_id, print_template_id, print_text,
                    guestbook_design_id, guestbook_names, guestbook_date
             FROM booking_personalizations WHERE booking_id = ?',
            [$booking['id']]
        );
        $booking['contract'] = Database::selectOne(
            "SELECT number, status, signed_at FROM contracts WHERE booking_id = ? AND status != 'cancelled' ORDER BY id DESC LIMIT 1",
            [$booking['id']]
        );
        $booking['bank_account'] = SettingsService::get('finance.bank_account', '');
        $booking['paynow_enabled'] = SettingsService::bool('paynow.enabled');
        // Wpłacono / pozostało — klient widzi faktycznie zaksięgowane kwoty (bywają inne niż zadatek)
        $paidInfo = BookingService::paidSummary((int) $booking['id'], (float) $booking['total_price']);
        $booking['paid_amount'] = $paidInfo['paid'];
        $booking['remaining_amount'] = $paidInfo['remaining'];
        return Response::json($booking);
    }

    /** Personalizacja po rezerwacji — do N dni przed imprezą (domyślnie 3). */
    public function updatePersonalization(Request $request): Response
    {
        $booking = $this->ownBooking($request);
        if ($booking === null) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        if (!$this->personalizationEditable($booking)) {
            return Response::error('Personalizacja jest już zablokowana — skontaktuj się z nami telefonicznie', 423);
        }
        $fields = array_intersect_key($request->all(), array_flip([
            'animation_id', 'background_id', 'print_template_id', 'print_text',
            'guestbook_design_id', 'guestbook_names', 'guestbook_date',
        ]));
        if (isset($fields['print_text']) && mb_strlen((string) $fields['print_text']) > 255) {
            return Response::error('Tekst na wydruku może mieć maks. 255 znaków', 422);
        }
        // Wzór i nadruk księgi dotyczą wyłącznie księgi personalizowanej
        if ($booking['guestbook'] !== 'personalized') {
            unset($fields['guestbook_design_id'], $fields['guestbook_names'], $fields['guestbook_date']);
        }
        Database::update('booking_personalizations', $fields, 'booking_id = ?', [$booking['id']]);
        return Response::json(['ok' => true]);
    }

    private function ownBooking(Request $request): ?array
    {
        $booking = BookingService::find((int) $request->params['id']);
        return $booking !== null && (int) $booking['user_id'] === $request->userId() ? $booking : null;
    }

    private function personalizationEditable(array $booking): bool
    {
        // Impreza zakończona / anulowana — personalizacji już nie zmieniamy.
        if (in_array($booking['status'], ['completed', 'cancelled'], true)) {
            return false;
        }
        // Ręczne odblokowanie przez administratora pomija blokadę terminową
        // (zarówno automatyczną z crona, jak i status „Gotowe do realizacji").
        if (!empty($booking['personalization_unlocked_at'])) {
            return true;
        }
        if ($booking['personalization_locked_at'] !== null) {
            return false;
        }
        if ($booking['status'] === 'ready') {
            return false;
        }
        $lockDays = SettingsService::int('booking.personalization_lock_days', 3);
        return strtotime($booking['event_date']) - time() > $lockDays * 86400;
    }
}
