<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Automatyczne pobieranie danych firmy po NIP — Wykaz Podatników VAT (API Ministerstwa Finansów).
 * Darmowe, bez klucza API.
 */
final class NipService
{
    public static function lookup(string $nip): ?array
    {
        $nip = preg_replace('/[^0-9]/', '', $nip);
        $res = Http::getJson(
            sprintf('https://wl-api.mf.gov.pl/api/search/nip/%s?date=%s', $nip, date('Y-m-d'))
        );
        $subject = $res['body']['result']['subject'] ?? null;
        if ($res['status'] !== 200 || $subject === null) {
            return null;
        }
        return [
            'company_name' => $subject['name'] ?? '',
            'nip' => $subject['nip'] ?? $nip,
            'address' => $subject['workingAddress'] ?? $subject['residenceAddress'] ?? '',
            'regon' => $subject['regon'] ?? '',
            'representatives' => array_map(
                fn($r) => trim(($r['firstName'] ?? '') . ' ' . ($r['lastName'] ?? '')),
                $subject['representatives'] ?? []
            ),
        ];
    }
}
