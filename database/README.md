# Baza danych — MySQL 8

## Uruchomienie migracji i seedów

```bash
cd ../backend
cp .env.example .env   # uzupełnij DB_HOST, DB_NAME, DB_USER, DB_PASS
php bin/migrate.php          # wykonuje migracje (idempotentnie) 
php bin/migrate.php --seed   # migracje + seedery (tylko na świeżej bazie)
```

Na hostingu LH.pl bez dostępu SSH: zaimportuj pliki w phpMyAdmin w kolejności
`migrations/001…005`, potem `seeds/001…006`.

## Struktura

- `migrations/` — schemat: numerowane pliki SQL, wykonywane raz (tabela `migrations` pilnuje stanu)
- `seeds/` — dane startowe: admin, atrakcje, pakiety z cennikiem 2026, ustawienia, szablony e-mail/SMS, katalog demo

## Najważniejsze relacje

```
users 1—1 client_profiles
attraction_types 1—N attractions 1—N bookings
packages 1—N package_prices (rok)         ◄ cennik per rok
bookings 1—1 booking_personalizations
bookings 1—N contracts / payments / booking_status_history
print_templates N—M hashtags
settings 1—N settings_audit (audyt zmian)
email_queue / sms_queue                   ◄ kolejki wysyłane cronem
```
