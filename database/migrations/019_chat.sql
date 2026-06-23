-- 019 — mini-czat klient ↔ admin (wątki tematyczne + wiadomości + załączniki).
-- Załączniki kasowane po imprezie (cron cleanup). Powiadomienia o nowych odpowiedziach: cron co 2h.
SET NAMES utf8mb4;

CREATE TABLE chat_threads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(150) NOT NULL,
  created_by ENUM('client','admin') NOT NULL,
  last_message_at DATETIME NULL,
  last_sender ENUM('client','admin') NULL,
  client_last_read_at DATETIME NULL,
  admin_last_read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_chat_threads_booking (booking_id),
  CONSTRAINT fk_chat_threads_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id BIGINT UNSIGNED NOT NULL,
  sender ENUM('client','admin') NOT NULL,
  sender_user_id BIGINT UNSIGNED NULL,
  body TEXT NULL,
  attachment_path VARCHAR(500) NULL COMMENT 'ścieżka względem backend/storage; NULL po skasowaniu po imprezie',
  attachment_name VARCHAR(255) NULL,
  attachment_mime VARCHAR(100) NULL,
  notified TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'czy druga strona dostała powiadomienie (cron)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chat_messages_thread (thread_id),
  KEY idx_chat_messages_notified (notified),
  CONSTRAINT fk_chat_messages_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_messages_user FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Powiadomienie e-mail o nowej odpowiedzi w wątku.
INSERT IGNORE INTO email_templates (code, name, subject, body, variables) VALUES
('chat_new_message', 'Nowa wiadomość w czacie', 'Nowa wiadomość: {{temat}}',
'<p>Dzień dobry {{imie}},</p><p>masz nową wiadomość w wątku <strong>{{temat}}</strong> dotyczącym rezerwacji.</p><p><a href="{{link}}">Otwórz rozmowę</a></p><p>{{stopka}}</p>',
'["imie","temat","link","stopka"]');
