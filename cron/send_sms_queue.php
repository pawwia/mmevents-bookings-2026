<?php

/** Wysyłka SMS z kolejki przez SMSAPI. Zalecane: co 5 minut. Retry: maks. 3 próby. */

declare(strict_types=1);

use App\Services\QueueService;

require __DIR__ . '/bootstrap.php';

$result = QueueService::processSms(25, 'cron_log');
cron_log("sms_queue: przetworzono {$result['processed']}, wysłano {$result['sent']}, błędów {$result['failed']}");
