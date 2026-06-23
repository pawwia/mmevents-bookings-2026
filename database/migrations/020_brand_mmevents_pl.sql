-- 020 — marka wyświetlana jako „mmevents.pl" w treściach SMS / e-mail / ustawieniach.
-- REPLACE jest case-sensitive: najpierw 'MMEvents', potem 'MMEvent', potem 'MMevent'.
-- Domena 'mmevents.pl' (małe litery) nie jest dotykana — nie powstaje 'mmevents.pls.pl'.
SET NAMES utf8mb4;

-- Pomijamy nadawcę SMS (musi być krótkim, alfanumerycznym ID ≤ 11 znaków — bez kropki).
UPDATE settings
SET value = REPLACE(REPLACE(REPLACE(value, 'MMEvents', 'mmevents.pl'), 'MMEvent', 'mmevents.pl'), 'MMevent', 'mmevents.pl')
WHERE `key` <> 'smsapi.sender';

UPDATE email_templates
SET subject = REPLACE(REPLACE(REPLACE(subject, 'MMEvents', 'mmevents.pl'), 'MMEvent', 'mmevents.pl'), 'MMevent', 'mmevents.pl'),
    body    = REPLACE(REPLACE(REPLACE(body,    'MMEvents', 'mmevents.pl'), 'MMEvent', 'mmevents.pl'), 'MMevent', 'mmevents.pl');

UPDATE sms_templates
SET body = REPLACE(REPLACE(REPLACE(body, 'MMEvents', 'mmevents.pl'), 'MMEvent', 'mmevents.pl'), 'MMevent', 'mmevents.pl');
