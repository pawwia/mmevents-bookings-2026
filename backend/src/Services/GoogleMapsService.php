<?php

declare(strict_types=1);

namespace App\Services;

/** Google Places (podpowiedzi lokalizacji) + Distance Matrix (dystans/czas od siedziby). */
final class GoogleMapsService
{
    /** Podpowiedzi miejsc (nazwa obiektu lub adres) — Places Autocomplete. */
    public static function autocomplete(string $query, ?string $sessionToken = null): array
    {
        $key = SettingsService::get('maps.places_api_key') ?: SettingsService::get('maps.api_key');
        if (!$key) {
            throw new \RuntimeException('Brak klucza Places API (Ustawienia → Google Maps)');
        }
        $params = http_build_query(array_filter([
            'input' => $query,
            'key' => $key,
            'language' => 'pl',
            'components' => 'country:pl',
            'sessiontoken' => $sessionToken,
        ]));
        $res = Http::getJson("https://maps.googleapis.com/maps/api/place/autocomplete/json?$params");
        $predictions = $res['body']['predictions'] ?? [];
        return array_map(fn($p) => [
            'place_id' => $p['place_id'],
            'description' => $p['description'],
            'main_text' => $p['structured_formatting']['main_text'] ?? $p['description'],
            'secondary_text' => $p['structured_formatting']['secondary_text'] ?? '',
        ], $predictions);
    }

    /** Szczegóły miejsca: adres, współrzędne, województwo (weryfikacja zasięgu). */
    public static function placeDetails(string $placeId): array
    {
        $key = SettingsService::get('maps.places_api_key') ?: SettingsService::get('maps.api_key');
        $params = http_build_query([
            'place_id' => $placeId,
            'key' => $key,
            'language' => 'pl',
            'fields' => 'name,formatted_address,geometry,address_components',
        ]);
        $res = Http::getJson("https://maps.googleapis.com/maps/api/place/details/json?$params");
        $result = $res['body']['result'] ?? [];

        $province = '';
        $city = '';
        foreach ($result['address_components'] ?? [] as $component) {
            $types = $component['types'] ?? [];
            if (in_array('administrative_area_level_1', $types, true)) {
                $province = mb_strtolower(trim(str_ireplace('województwo', '', $component['long_name'] ?? '')));
            }
            if (in_array('locality', $types, true)) {
                $city = $component['long_name'] ?? '';
            }
        }

        return [
            'name' => $result['name'] ?? '',
            'address' => $result['formatted_address'] ?? '',
            'lat' => $result['geometry']['location']['lat'] ?? null,
            'lng' => $result['geometry']['location']['lng'] ?? null,
            'province' => $province,
            'city' => $city,
        ];
    }

    /** Czy lokalizacja leży w obsługiwanych województwach (ustawienie maps.allowed_provinces). */
    public static function provinceAllowed(string $province): bool
    {
        $allowed = array_filter(array_map(
            'trim',
            explode(',', mb_strtolower((string) SettingsService::get('maps.allowed_provinces', '')))
        ));
        return $allowed === [] || in_array(mb_strtolower($province), $allowed, true);
    }

    /**
     * Kilometry do rozliczenia transportu — liczone od GRANICY Szczecina:
     *  - impreza w Szczecinie (maps.free_city): 0 km (dojazd gratis w każdym pakiecie),
     *  - poza miastem: trasa z centrum (maps.billing_origin) minus promień miasta
     *    (maps.city_free_km — przybliżenie odległości centrum→granica w danym kierunku).
     * Czas dojazdu (logistyka) nadal liczony z siedziby (maps.origin_address).
     *
     * @return array{distance_km: float, duration_min: int, raw_distance_km: float, in_free_city: bool}
     */
    public static function billedDistance(string $destinationAddress, string $destinationCity = ''): array
    {
        $travel = self::distanceFromHq($destinationAddress);

        $freeCity = trim((string) SettingsService::get('maps.free_city', 'Szczecin'));
        $inFreeCity = $freeCity !== '' && (
            mb_stripos($destinationCity, $freeCity) !== false
            || mb_stripos($destinationAddress, $freeCity) !== false
        );
        if ($inFreeCity) {
            return [
                'distance_km' => 0.0,
                'duration_min' => $travel['duration_min'],
                'raw_distance_km' => $travel['distance_km'],
                'in_free_city' => true,
            ];
        }

        $billingOrigin = SettingsService::get('maps.billing_origin', 'Szczecin, Polska');
        $fromCenter = self::distance($billingOrigin, $destinationAddress);
        $cityRadius = SettingsService::float('maps.city_free_km', 9.0);

        return [
            'distance_km' => max(0.0, round($fromCenter['distance_km'] - $cityRadius, 1)),
            'duration_min' => $travel['duration_min'],
            'raw_distance_km' => $travel['distance_km'],
            'in_free_city' => false,
        ];
    }

    /**
     * Dystans (km) i czas dojazdu (min) między dwoma punktami.
     * @return array{distance_km: float, duration_min: int}
     */
    public static function distance(string $origin, string $destination): array
    {
        $key = SettingsService::get('maps.distance_api_key') ?: SettingsService::get('maps.api_key');
        if (!$key) {
            throw new \RuntimeException('Brak klucza Distance Matrix API (Ustawienia → Google Maps)');
        }
        $params = http_build_query([
            'origins' => $origin,
            'destinations' => $destination,
            'key' => $key,
            'language' => 'pl',
            'units' => 'metric',
        ]);
        $res = Http::getJson("https://maps.googleapis.com/maps/api/distancematrix/json?$params");
        $element = $res['body']['rows'][0]['elements'][0] ?? null;
        if (($element['status'] ?? '') !== 'OK') {
            throw new \RuntimeException('Nie udało się obliczyć trasy: ' . ($element['status'] ?? 'brak odpowiedzi'));
        }
        return [
            'distance_km' => round($element['distance']['value'] / 1000, 1),
            'duration_min' => (int) ceil($element['duration']['value'] / 60),
        ];
    }

    /** Dystans i czas dojazdu z siedziby firmy do podanej lokalizacji. */
    public static function distanceFromHq(string $destination): array
    {
        $origin = SettingsService::get('maps.origin_address', 'Wiejska 4A, Szczecin, Polska');
        return self::distance($origin, $destination);
    }
}
