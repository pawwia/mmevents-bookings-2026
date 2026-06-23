<?php

/**
 * Powiadomienia o nowych wiadomościach w czacie (klient ↔ admin).
 * Wysyła e-mail do strony, która ma nieobsłużone wiadomości od drugiej strony.
 * Zalecane: co 2 godziny.
 */

declare(strict_types=1);

use App\Services\ChatService;

require __DIR__ . '/bootstrap.php';

$sent = ChatService::notifyPending();
cron_log("chat_notify: wysłano powiadomień = $sent");
