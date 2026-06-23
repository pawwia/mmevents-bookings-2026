-- 009 — własny moduł podpisywania umów (SMS OTP + Brevo), zastępuje Pergamin
-- Bezpieczna, addytywna migracja: nie usuwa danych CRM, jedynie rozszerza schemat.
SET NAMES utf8mb4;

-- ───────────────────────────────────────────────────────────────────────────
-- contracts: typ, status podpisu, hash SHA256, ścieżki dokumentów, folder Drive
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE contracts
  ADD COLUMN type ENUM('standard','editable','uploaded') NOT NULL DEFAULT 'standard' AFTER number,
  ADD COLUMN signing_status ENUM('draft','pending_owner','owner_signed','pending_client','fully_signed','cancelled')
    NOT NULL DEFAULT 'draft' AFTER status,
  ADD COLUMN document_hash CHAR(64) NULL AFTER signing_status,
  ADD COLUMN hash_generated_at DATETIME NULL AFTER document_hash,
  ADD COLUMN pdf_path VARCHAR(500) NULL COMMENT 'PDF umowy (przed stroną potwierdzenia)' AFTER drive_url,
  ADD COLUMN html_path VARCHAR(500) NULL COMMENT 'HTML do podglądu z wykrywaniem przewinięcia' AFTER pdf_path,
  ADD COLUMN signed_pdf_path VARCHAR(500) NULL COMMENT 'Końcowy PDF: umowa + strona potwierdzenia' AFTER html_path,
  ADD COLUMN editable_doc_id VARCHAR(255) NULL COMMENT 'ID dokumentu Google Docs do ręcznej edycji' AFTER signed_pdf_path,
  ADD COLUMN editable_doc_url VARCHAR(500) NULL AFTER editable_doc_id,
  ADD COLUMN signed_folder_id VARCHAR(255) NULL COMMENT 'Folder Drive na podpisaną umowę (per zlecenie)' AFTER editable_doc_url,
  ADD COLUMN drive_signed_file_id VARCHAR(255) NULL AFTER signed_folder_id,
  ADD COLUMN drive_signed_url VARCHAR(500) NULL AFTER drive_signed_file_id,
  ADD COLUMN owner_signed_at DATETIME NULL AFTER drive_signed_url,
  ADD COLUMN client_signed_at DATETIME NULL AFTER owner_signed_at,
  ADD COLUMN fully_signed_at DATETIME NULL AFTER client_signed_at;

-- Pozostałość po Pergamin — usuwamy kolumnę (brak danych, integracja była wyłączona)
ALTER TABLE contracts DROP COLUMN pergamin_document_id;

-- ───────────────────────────────────────────────────────────────────────────
-- contract_signatures: dowód podpisu każdej ze stron
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE contract_signatures (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id BIGINT UNSIGNED NOT NULL,
  party ENUM('owner','client') NOT NULL,
  signed_at DATETIME NOT NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  phone VARCHAR(30) NULL,
  otp_identifier CHAR(16) NULL COMMENT 'publiczny identyfikator OTP (na stronie potwierdzenia)',
  document_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_signature_party (contract_id, party),
  KEY idx_signatures_contract (contract_id),
  CONSTRAINT fk_signatures_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- contract_sms_codes: kody OTP (przechowywany wyłącznie hash kodu)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE contract_sms_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id BIGINT UNSIGNED NOT NULL,
  party ENUM('owner','client') NOT NULL,
  otp_identifier CHAR(16) NOT NULL,
  code_hash VARCHAR(255) NOT NULL COMMENT 'hash kodu OTP — nigdy plaintext',
  phone VARCHAR(30) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sms_otp (otp_identifier),
  KEY idx_sms_codes_contract (contract_id, party),
  CONSTRAINT fk_sms_codes_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- contract_events: timeline procesu podpisywania
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE contract_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(60) NOT NULL,
  message VARCHAR(255) NOT NULL,
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_events_contract (contract_id, created_at),
  CONSTRAINT fk_events_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- email_queue: załącznik (podpisany PDF wysyłany przez Brevo)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE email_queue
  ADD COLUMN attachment_path VARCHAR(500) NULL AFTER body,
  ADD COLUMN attachment_name VARCHAR(255) NULL AFTER attachment_path;

-- ───────────────────────────────────────────────────────────────────────────
-- Ustawienia: dane właściciela do podpisu + folder podpisanych umów; usuń Pergamin
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('signing', 'signing.owner_name',  '', 'string', 'Imię i nazwisko właściciela (podpis)', 0, 1),
('signing', 'signing.owner_phone', '', 'string', 'Telefon właściciela do podpisu SMS', 0, 2),
('signing', 'signing.place',       'Szczecin', 'string', 'Miejscowość zawarcia umowy', 0, 3),
('drive',   'drive.signed_contracts_folder_id', '', 'string', 'Domyślny folder Drive na podpisane umowy', 0, 6);

DELETE FROM settings WHERE `group` = 'pergamin';

-- Szablony wiadomości procesu podpisu
INSERT INTO email_templates (code, name, subject, body, variables) VALUES
('contract_awaiting_client', 'Umowa oczekuje na podpis klienta', 'Umowa {{numer_umowy}} oczekuje na Twój podpis',
'<p>Dzień dobry {{imie}},</p><p>umowa <strong>{{numer_umowy}}</strong> została podpisana przez MMEvent i oczekuje na Twój podpis.</p><p>Zaloguj się do panelu klienta, zapoznaj się z treścią umowy i podpisz ją kodem SMS:</p><p><a href="{{link_panelu}}">{{link_panelu}}</a></p><p>{{stopka}}</p>',
'["imie","numer_umowy","link_panelu","stopka"]'),
('contract_signed_copy', 'Podpisana umowa', 'Twoja podpisana umowa {{numer_umowy}}',
'<p>Dzień dobry {{imie}},</p><p>w załączniku przesyłamy obustronnie podpisaną umowę <strong>{{numer_umowy}}</strong> wraz ze stroną potwierdzenia podpisu.</p><p>{{stopka}}</p>',
'["imie","numer_umowy","stopka"]');

INSERT INTO sms_templates (code, name, body, variables) VALUES
('contract_awaiting_client', 'Umowa oczekuje na podpis klienta',
 'MMEvent: umowa {{numer_umowy}} oczekuje na Twoj podpis. Zaloguj sie do panelu klienta, aby ja podpisac.',
 '["numer_umowy"]'),
('otp_code', 'Kod SMS do podpisu umowy',
 'MMEvent: Twoj kod do podpisu umowy {{numer_umowy}}: {{kod}}. Wazny 10 minut. Nie udostepniaj go nikomu.',
 '["numer_umowy","kod"]');
