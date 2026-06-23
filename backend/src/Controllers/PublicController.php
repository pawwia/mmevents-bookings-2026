<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\AvailabilityService;
use App\Services\CloudflareService;
use App\Services\GoogleMapsService;
use App\Services\NipService;
use App\Services\PricingService;
use App\Services\RateLimitService;
use App\Services\SettingsService;

/** Endpointy publiczne onboardingu: ustawienia, pakiety, dostępność, lokalizacje, wycena, NIP. */
class PublicController
{
    /** Publiczne ustawienia (kolory, logo, nazwa firmy, czy PayNow włączony). */
    public function settings(Request $request): Response
    {
        return Response::json(SettingsService::publicSettings());
    }

    /** Pakiety z cennikiem dla roku (domyślnie: rok z ?date= albo bieżący). */
    public function packages(Request $request): Response
    {
        $date = (string) ($request->query['date'] ?? date('Y-m-d'));
        $year = (int) substr($date, 0, 4);
        $packages = Database::select(
            'SELECT p.id, p.name, p.duration_hours, p.sort_order, at.name AS attraction_type
             FROM packages p
             JOIN attraction_types at ON at.id = p.attraction_type_id
             WHERE p.is_active = 1 AND at.is_active = 1
             ORDER BY p.sort_order'
        );
        $out = [];
        foreach ($packages as $package) {
            $price = PricingService::priceForYear((int) $package['id'], $year);
            if ($price === null) {
                continue; // brak cennika na ten rok — pakiet niedostępny
            }
            $out[] = $package + [
                'price' => (float) $price['price'],
                'free_km' => (int) $price['free_km'],
                'description' => $price['description'],
                'features' => json_decode((string) $price['features'], true) ?: ['included' => [], 'excluded' => []],
                'guestbook_standard_price' => (float) $price['guestbook_standard_price'],
                'guestbook_personalized_price' => (float) $price['guestbook_personalized_price'],
                'year' => $year,
            ];
        }
        return Response::json($out);
    }

    /**
     * Krok 1: lata, na które można rezerwować (mają wprowadzony cennik w CRM).
     * Kalendarz onboardingu blokuje wybór dni z lat spoza tej listy.
     */
    public function bookingYears(Request $request): Response
    {
        $years = PricingService::bookableYears();
        return Response::json([
            'years' => $years,
            'max_date' => $years === [] ? null : max($years) . '-12-31',
        ]);
    }

    /** Krok 1: sprawdzenie terminu. Limit: 10 sprawdzeń → blokada 20 min, kolejne 10 → 5 h. */
    public function checkDate(Request $request): Response
    {
        $ip = BookingController::clientIp();

        // Już zablokowany (poprzednie naruszenie) — odrzucamy bez zwiększania licznika.
        $wait = RateLimitService::blockedFor('availability', $ip);
        if ($wait > 0) {
            return Response::error(
                'Przekroczono limit sprawdzeń terminu. Spróbuj ponownie za ' . self::humanWait($wait)
                . ' lub skontaktuj się z nami bezpośrednio.',
                429
            );
        }

        $date = (string) ($request->query['date'] ?? '');
        $v = Validator::make(['date' => $date], ['date' => 'required|date']);
        if ($v->fails()) {
            return Response::error('Podaj prawidłową datę', 422, $v->errors());
        }
        if ($date < date('Y-m-d')) {
            return Response::error('Data nie może być z przeszłości', 422);
        }
        // Turnstile: wystarczy raz przejść weryfikację — IP jest potem zaufane przez jakiś czas,
        // więc kolejne sprawdzenia nie wymagają nowego tokenu (bez ponownego klikania checkboxa).
        if (CloudflareService::enabled()) {
            $token = $request->query['cf_token'] ?? null;
            if ($token !== null && $token !== '') {
                if (!CloudflareService::verify($token, $ip)) {
                    return Response::error('Weryfikacja Cloudflare nie powiodła się — spróbuj ponownie.', 403);
                }
                CloudflareService::markVerified($ip);
            } elseif (!CloudflareService::isVerified($ip)) {
                return Response::error('Potwierdź, że nie jesteś robotem (Cloudflare).', 403);
            }
        }

        // Zarejestruj sprawdzenie (10 dozwolonych; przekroczenie → blokada z eskalacją 20 min / 5 h).
        $rl = RateLimitService::register('availability', $ip, 10, [1200, 18000]);
        if ($rl['blocked']) {
            return Response::error(
                'Przekroczono limit sprawdzeń terminu. Spróbuj ponownie za ' . self::humanWait($rl['retry_after'])
                . ' lub skontaktuj się z nami bezpośrednio.',
                429
            );
        }

        // Rok bez cennika w CRM — nie da się sprawdzić dostępności ani wycenić.
        if (!PricingService::isYearBookable((int) substr($date, 0, 4))) {
            return Response::json([
                'available' => false,
                'year_bookable' => false,
                'windows' => [],
                'remaining_checks' => $rl['remaining'],
                'message' => sprintf(
                    'Rezerwacje na rok %s nie są jeszcze dostępne. Pracujemy nad cennikiem na ten sezon — '
                    . 'zapraszamy wkrótce lub skontaktuj się z nami bezpośrednio.',
                    substr($date, 0, 4)
                ),
            ]);
        }
        $result = AvailabilityService::checkDate($date);
        $result['year_bookable'] = true;
        $result['remaining_checks'] = $rl['remaining'];

        // Log sprawdzenia terminu (kto / kiedy / IP) — do analizy w CRM
        Database::insert('availability_checks', [
            'check_date' => $date,
            'ip' => BookingController::clientIp(),
            'user_agent' => mb_substr((string) ($request->header('user-agent') ?? ''), 0, 500),
            'user_id' => is_array($request->user) ? ($request->user['id'] ?? null) : null,
            'available' => $result['available'] ? 1 : 0,
        ]);

        return Response::json($result);
    }

    /** Czytelny czas oczekiwania dla komunikatów blokady. */
    private static function humanWait(int $seconds): string
    {
        return $seconds >= 3600
            ? (int) ceil($seconds / 3600) . ' godz.'
            : max(1, (int) ceil($seconds / 60)) . ' min';
    }

    /** Analiza wykonalności konkretnej godziny (czas imprezy + dojazd + montaż 1h + demontaż 40min). */
    public function checkFeasibility(Request $request): Response
    {
        $v = Validator::make($request->all(), [
            'date' => 'required|date',
            'start_time' => 'required|time',
            'duration_hours' => 'required|numeric',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane', 422, $v->errors());
        }
        return Response::json(AvailabilityService::checkFeasibility(
            (string) $request->input('date'),
            (string) $request->input('start_time'),
            (float) $request->input('duration_hours'),
            $request->input('venue_address'),
        ));
    }

    /** Podpowiedzi lokalizacji Google Places. */
    public function placesAutocomplete(Request $request): Response
    {
        $query = trim((string) ($request->query['q'] ?? ''));
        if (mb_strlen($query) < 3) {
            return Response::json([]);
        }
        return Response::json(GoogleMapsService::autocomplete($query, $request->query['session'] ?? null));
    }

    /**
     * Szczegóły miejsca + km do rozliczenia (od granicy Szczecina) + czas dojazdu.
     * 422, gdy lokalizacja poza obsługiwanymi województwami (zachodniopomorskie, lubuskie).
     */
    public function placeDetails(Request $request): Response
    {
        $placeId = (string) ($request->query['place_id'] ?? '');
        if ($placeId === '') {
            return Response::error('Brak place_id', 422);
        }
        $details = GoogleMapsService::placeDetails($placeId);
        if (!GoogleMapsService::provinceAllowed($details['province'])) {
            $allowed = (string) SettingsService::get('maps.allowed_provinces', '');
            return Response::error(
                'Obsługujemy wyłącznie województwa: ' . str_replace(',', ', ', $allowed)
                . '. Wybrana lokalizacja jest poza naszym zasięgiem.',
                422
            );
        }
        $distance = GoogleMapsService::billedDistance($details['address'], $details['city']);
        return Response::json($details + $distance);
    }

    /** Wycena (krok 7 — podsumowanie): pakiet + transport + księga − rabat. */
    public function quote(Request $request): Response
    {
        $v = Validator::make($request->all(), [
            'package_id' => 'required|int',
            'event_date' => 'required|date',
            'distance_km' => 'required|numeric',
            'guestbook' => 'in:none,standard,personalized',
        ]);
        if ($v->fails()) {
            return Response::error('Błędne dane', 422, $v->errors());
        }
        $quote = PricingService::quote(
            (int) $request->input('package_id'),
            (string) $request->input('event_date'),
            (float) $request->input('distance_km'),
            (string) $request->input('guestbook', 'none'),
            $request->input('discount_code'),
        );
        unset($quote['discount']); // szczegóły kodu nie są potrzebne klientowi
        return Response::json($quote);
    }

    /** Automatyczne pobranie danych firmy po NIP (Wykaz Podatników VAT MF). */
    public function nipLookup(Request $request): Response
    {
        $nip = (string) ($request->query['nip'] ?? '');
        if (!Validator::validNip($nip)) {
            return Response::error('Nieprawidłowy NIP', 422);
        }
        $data = NipService::lookup($nip);
        return $data === null
            ? Response::error('Nie znaleziono firmy o podanym NIP', 404)
            : Response::json($data);
    }

    /** Katalog personalizacji (publiczny podgląd). */
    public function animations(Request $request): Response
    {
        return Response::json(Database::select(
            'SELECT id, name, thumbnail_url, youtube_url FROM animations WHERE is_active = 1 ORDER BY sort_order'
        ));
    }

    public function backgrounds(Request $request): Response
    {
        return Response::json(Database::select(
            'SELECT id, name, image_url FROM backgrounds WHERE is_active = 1 ORDER BY sort_order'
        ));
    }

    public function printTemplates(Request $request): Response
    {
        $templates = Database::select(
            'SELECT pt.id, pt.name, pt.image_url FROM print_templates pt WHERE pt.is_active = 1 ORDER BY pt.sort_order'
        );
        $tags = Database::select(
            'SELECT pth.print_template_id, h.name FROM print_template_hashtag pth JOIN hashtags h ON h.id = pth.hashtag_id'
        );
        $byTemplate = [];
        foreach ($tags as $tag) {
            $byTemplate[(int) $tag['print_template_id']][] = $tag['name'];
        }
        foreach ($templates as &$template) {
            $template['hashtags'] = $byTemplate[(int) $template['id']] ?? [];
        }
        return Response::json($templates);
    }

    /** Wzory ksiąg personalizowanych (z hashtagami: wesele, urodziny, rocznica…). */
    public function guestbookDesigns(Request $request): Response
    {
        $designs = Database::select(
            'SELECT id, name, image_url FROM guestbook_designs WHERE is_active = 1 ORDER BY sort_order'
        );
        $tags = Database::select(
            'SELECT gdh.guestbook_design_id, h.name FROM guestbook_design_hashtag gdh JOIN hashtags h ON h.id = gdh.hashtag_id'
        );
        $byDesign = [];
        foreach ($tags as $tag) {
            $byDesign[(int) $tag['guestbook_design_id']][] = $tag['name'];
        }
        foreach ($designs as &$design) {
            $design['hashtags'] = $byDesign[(int) $design['id']] ?? [];
        }
        return Response::json($designs);
    }

    public function hashtags(Request $request): Response
    {
        return Response::json(Database::select('SELECT id, name FROM hashtags ORDER BY name'));
    }
}
