<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Wycena rezerwacji:
 *   cena pakietu (cennik roku imprezy) + transport ponad limit km + księga gości − rabat.
 * Zadatek: procent z ustawień (domyślnie 30%).
 */
final class PricingService
{
    /** Cennik pakietu dla roku imprezy (fallback: najnowszy rok ≤ rok imprezy). */
    public static function priceForYear(int $packageId, int $year): ?array
    {
        return Database::selectOne(
            'SELECT * FROM package_prices
             WHERE package_id = ? AND year <= ? AND is_active = 1
             ORDER BY year DESC LIMIT 1',
            [$packageId, $year]
        );
    }

    /**
     * Lata, na które można rezerwować — czyli takie, dla których administrator
     * wprowadził w CRM aktywny cennik (≥1 pakiet). Bez cennika danego roku nie da się
     * sprawdzić terminu ani wycenić rezerwacji. Tylko lata bieżące i przyszłe.
     *
     * @return int[] posortowane rosnąco
     */
    public static function bookableYears(): array
    {
        $rows = Database::select(
            'SELECT DISTINCT year FROM package_prices WHERE is_active = 1 AND year >= ? ORDER BY year',
            [(int) date('Y')]
        );
        return array_map(static fn (array $row): int => (int) $row['year'], $rows);
    }

    /** Czy na dany rok można już rezerwować (jest aktywny cennik)? */
    public static function isYearBookable(int $year): bool
    {
        return in_array($year, self::bookableYears(), true);
    }

    public static function transportCost(float $distanceKm, int $freeKm, ?float $kmRate = null): array
    {
        $rate = $kmRate ?? SettingsService::float('finance.km_rate', 1.60);
        $extraKm = max(0.0, $distanceKm - $freeKm);
        return [
            'extra_km' => round($extraKm, 1),
            'km_rate' => $rate,
            'cost' => round($extraKm * $rate, 2),
        ];
    }

    public static function guestbookPrice(array $packagePrice, string $guestbook): float
    {
        return match ($guestbook) {
            'standard' => (float) $packagePrice['guestbook_standard_price'],
            'personalized' => (float) $packagePrice['guestbook_personalized_price'],
            default => 0.0,
        };
    }

    /** Walidacja i wyliczenie rabatu. @return array{discount: array|null, amount: float, error: string|null} */
    public static function applyDiscount(?string $code, float $subtotal): array
    {
        if ($code === null || trim($code) === '') {
            return ['discount' => null, 'amount' => 0.0, 'error' => null];
        }
        $discount = Database::selectOne('SELECT * FROM discount_codes WHERE code = ?', [trim($code)]);
        $today = date('Y-m-d');
        $error = match (true) {
            $discount === null => 'Nieprawidłowy kod rabatowy',
            !(int) $discount['is_active'] => 'Kod rabatowy jest nieaktywny',
            $discount['valid_from'] !== null && $discount['valid_from'] > $today => 'Kod rabatowy jeszcze nie obowiązuje',
            $discount['valid_until'] !== null && $discount['valid_until'] < $today => 'Kod rabatowy wygasł',
            $discount['usage_limit'] !== null && (int) $discount['used_count'] >= (int) $discount['usage_limit'] => 'Limit użyć kodu został wyczerpany',
            default => null,
        };
        if ($error !== null) {
            return ['discount' => null, 'amount' => 0.0, 'error' => $error];
        }
        $amount = $discount['type'] === 'percent'
            ? round($subtotal * (float) $discount['value'] / 100, 2)
            : min((float) $discount['value'], $subtotal);
        return ['discount' => $discount, 'amount' => $amount, 'error' => null];
    }

    /**
     * Pełna wycena. Zwraca strukturę gotową do zapisania jako snapshot w bookings.
     */
    public static function quote(
        int $packageId,
        string $eventDate,
        float $distanceKm,
        string $guestbook = 'none',
        ?string $discountCode = null,
    ): array {
        $year = (int) substr($eventDate, 0, 4);
        $price = self::priceForYear($packageId, $year);
        if ($price === null) {
            throw new \RuntimeException("Brak cennika dla wybranego pakietu w roku $year");
        }
        $transport = self::transportCost($distanceKm, (int) $price['free_km']);
        $guestbookPrice = self::guestbookPrice($price, $guestbook);
        $subtotal = (float) $price['price'] + $transport['cost'] + $guestbookPrice;
        $discountResult = self::applyDiscount($discountCode, $subtotal);

        $total = round($subtotal - $discountResult['amount'], 2);
        $depositPercent = SettingsService::float('finance.deposit_percent', 30.0);

        return [
            'package_price_id' => (int) $price['id'],
            'package_price' => (float) $price['price'],
            'free_km' => (int) $price['free_km'],
            'km_rate' => $transport['km_rate'],
            'extra_km' => $transport['extra_km'],
            'transport_cost' => $transport['cost'],
            'guestbook' => $guestbook,
            'guestbook_price' => $guestbookPrice,
            'discount' => $discountResult['discount'],
            'discount_amount' => $discountResult['amount'],
            'discount_error' => $discountResult['error'],
            'total_price' => $total,
            'deposit_percent' => $depositPercent,
            'deposit_amount' => round($total * $depositPercent / 100, 2),
            'currency' => SettingsService::get('finance.currency', 'PLN'),
        ];
    }
}
