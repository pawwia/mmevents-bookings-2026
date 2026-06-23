<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Kody OTP do podpisu umów.
 * Bezpieczeństwo: 6 cyfr, ważność 10 minut, maks. 5 prób, przechowywany wyłącznie hash kodu,
 * po wykorzystaniu oznaczany jako zużyty. Każdy kod ma publiczny identyfikator (otp_identifier)
 * umieszczany na stronie potwierdzenia podpisu.
 */
final class OtpService
{
    private const TTL_MINUTES = 10;
    private const MAX_ATTEMPTS = 5;
    private const LENGTH = 6;

    /**
     * Generuje i zapisuje nowy kod dla (umowa, strona). Unieważnia poprzednie aktywne kody.
     * Zwraca ['code' => '######', 'otp_identifier' => '...'] — `code` służy wyłącznie do wysyłki SMS.
     */
    public static function issue(int $contractId, string $party, string $phone): array
    {
        // Unieważnij wcześniejsze niezużyte kody tej strony (jednorazowo aktywny tylko najnowszy)
        Database::execute(
            "UPDATE contract_sms_codes SET consumed_at = NOW()
             WHERE contract_id = ? AND party = ? AND consumed_at IS NULL",
            [$contractId, $party]
        );

        $code = str_pad((string) random_int(0, 999999), self::LENGTH, '0', STR_PAD_LEFT);
        $identifier = bin2hex(random_bytes(8)); // 16 znaków hex

        Database::insert('contract_sms_codes', [
            'contract_id' => $contractId,
            'party' => $party,
            'otp_identifier' => $identifier,
            'code_hash' => password_hash($code, PASSWORD_BCRYPT),
            'phone' => $phone,
            'max_attempts' => self::MAX_ATTEMPTS,
            'expires_at' => date('Y-m-d H:i:s', time() + self::TTL_MINUTES * 60),
        ]);

        return ['code' => $code, 'otp_identifier' => $identifier];
    }

    /**
     * Weryfikuje kod dla (umowa, strona). Zwraca otp_identifier zużytego kodu przy sukcesie.
     * @return array{ok:bool, error:?string, otp_identifier:?string}
     */
    public static function verify(int $contractId, string $party, string $code): array
    {
        $row = Database::selectOne(
            "SELECT * FROM contract_sms_codes
             WHERE contract_id = ? AND party = ? AND consumed_at IS NULL
             ORDER BY id DESC LIMIT 1",
            [$contractId, $party]
        );
        if ($row === null) {
            return ['ok' => false, 'error' => 'Brak aktywnego kodu — wyślij kod ponownie.', 'otp_identifier' => null];
        }
        if (strtotime($row['expires_at']) < time()) {
            return ['ok' => false, 'error' => 'Kod wygasł — wyślij kod ponownie.', 'otp_identifier' => null];
        }
        if ((int) $row['attempts'] >= (int) $row['max_attempts']) {
            Database::update('contract_sms_codes', ['consumed_at' => date('Y-m-d H:i:s')], 'id = ?', [$row['id']]);
            return ['ok' => false, 'error' => 'Przekroczono liczbę prób — wyślij kod ponownie.', 'otp_identifier' => null];
        }

        Database::execute('UPDATE contract_sms_codes SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);

        if (!password_verify($code, $row['code_hash'])) {
            $left = (int) $row['max_attempts'] - ((int) $row['attempts'] + 1);
            return [
                'ok' => false,
                'error' => $left > 0 ? "Nieprawidłowy kod. Pozostałe próby: $left." : 'Nieprawidłowy kod — wyślij kod ponownie.',
                'otp_identifier' => null,
            ];
        }

        Database::update('contract_sms_codes', ['consumed_at' => date('Y-m-d H:i:s')], 'id = ?', [$row['id']]);
        return ['ok' => true, 'error' => null, 'otp_identifier' => $row['otp_identifier']];
    }
}
