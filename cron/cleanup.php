<?php

/** Porządki: wysłane wpisy kolejek starsze niż 90 dni, audyt starszy niż 2 lata. Raz dziennie. */

declare(strict_types=1);

use App\Core\Database;
use App\Services\ChatService;

require __DIR__ . '/bootstrap.php';

$emails = Database::execute("DELETE FROM email_queue WHERE status = 'sent' AND sent_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
$sms = Database::execute("DELETE FROM sms_queue WHERE status = 'sent' AND sent_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
$audit = Database::execute('DELETE FROM settings_audit WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR)');
// Załączniki czatów rezerwacji po imprezie (pliki znikają, treść wiadomości zostaje).
$chatFiles = ChatService::cleanupPastEventAttachments();

cron_log("cleanup: e-maile=$emails, sms=$sms, audyt=$audit, zalaczniki_chat=$chatFiles");
