# Cron — zadania cykliczne

Każde zadanie to osobny plik. Uruchamianie:

- **CLI (VPS / lokalnie):** `php cron/send_email_queue.php`
- **HTTP (panel cron LH.pl):** `https://api.twojadomena.pl/cron/send_email_queue.php?secret=CRON_SECRET`
  (sekret ustaw w `backend/.env` → `CRON_SECRET`)

## Harmonogram (zalecany)

| Plik                       | Częstotliwość | Crontab                  |
|----------------------------|---------------|--------------------------|
| `send_email_queue.php`     | co 5 min      | `*/5 * * * *`            |
| `send_sms_queue.php`       | co 5 min      | `*/5 * * * *`            |
| `send_reminders.php`       | raz dziennie  | `0 8 * * *` (godz. z ustawienia `booking.cron_hour`) |
| `lock_personalization.php` | raz dziennie  | `5 8 * * *`              |
| `sync_google_calendar.php` | co 15 min     | `*/15 * * * *`           |
| `chat_notify.php`          | co 2 godziny  | `0 */2 * * *`            |
| `cleanup.php`              | raz dziennie  | `30 3 * * *`             |

Logi: `backend/storage/logs/cron.log`.
