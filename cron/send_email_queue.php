<?php

/** Wysyłka e-maili z kolejki przez Brevo. Zalecane: co 5 minut. Retry: maks. 3 próby. */

declare(strict_types=1);

use App\Services\QueueService;

require __DIR__ . '/bootstrap.php';

$result = QueueService::processEmails(25, 'cron_log');
cron_log("email_queue: przetworzono {$result['processed']}, wysłano {$result['sent']}, błędów {$result['failed']}");
