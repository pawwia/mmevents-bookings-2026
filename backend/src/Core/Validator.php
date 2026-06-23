<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Prosty walidator wejścia. Reguły: required, email, phone, date, time,
 * numeric, int, min:N, max:N, in:a,b,c, nip, postal_code, password.
 */
final class Validator
{
    private array $errors = [];

    public static function make(array $data, array $rules): self
    {
        $v = new self();
        foreach ($rules as $field => $ruleString) {
            $value = $data[$field] ?? null;
            foreach (explode('|', $ruleString) as $rule) {
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
                $isEmpty = $value === null || $value === '';

                if ($name === 'required' && $isEmpty) {
                    $v->errors[$field][] = 'Pole jest wymagane';
                    break;
                }
                if ($isEmpty) {
                    continue; // pozostałe reguły tylko dla wypełnionych pól
                }
                $error = match ($name) {
                    'email'   => filter_var($value, FILTER_VALIDATE_EMAIL) ? null : 'Nieprawidłowy adres e-mail',
                    'phone'   => preg_match('/^\+?[0-9 \-]{7,20}$/', (string) $value) ? null : 'Nieprawidłowy numer telefonu',
                    'date'    => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $value) && strtotime((string) $value) ? null : 'Nieprawidłowa data (RRRR-MM-DD)',
                    'time'    => preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) $value) ? null : 'Nieprawidłowa godzina (HH:MM)',
                    'numeric' => is_numeric($value) ? null : 'Wartość musi być liczbą',
                    'int'     => filter_var($value, FILTER_VALIDATE_INT) !== false ? null : 'Wartość musi być liczbą całkowitą',
                    'min'     => mb_strlen((string) $value) >= (int) $param ? null : "Minimalna długość: $param",
                    'max'     => mb_strlen((string) $value) <= (int) $param ? null : "Maksymalna długość: $param",
                    'in'      => in_array((string) $value, explode(',', (string) $param), true) ? null : 'Niedozwolona wartość',
                    'nip'     => self::validNip((string) $value) ? null : 'Nieprawidłowy NIP',
                    'postal_code' => preg_match('/^\d{2}-\d{3}$/', (string) $value) ? null : 'Nieprawidłowy kod pocztowy (00-000)',
                    'password' => self::strongPassword((string) $value) ? null : 'Hasło: min. 8 znaków, w tym litera, cyfra i znak specjalny',
                    default   => null,
                };
                if ($error !== null) {
                    $v->errors[$field][] = $error;
                }
            }
        }
        return $v;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    public function errors(): array
    {
        return $this->errors;
    }

    /** Silne hasło: min. 8 znaków, w tym litera, cyfra i znak specjalny. */
    public static function strongPassword(string $password): bool
    {
        return mb_strlen($password) >= 8
            && preg_match('/[A-Za-z]/', $password) === 1
            && preg_match('/\d/', $password) === 1
            && preg_match('/[^A-Za-z0-9]/', $password) === 1;
    }

    public static function validNip(string $nip): bool
    {
        $nip = preg_replace('/[^0-9]/', '', $nip);
        if (strlen($nip) !== 10) {
            return false;
        }
        $weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        $sum = 0;
        foreach ($weights as $i => $w) {
            $sum += $w * (int) $nip[$i];
        }
        return $sum % 11 === (int) $nip[9];
    }
}
