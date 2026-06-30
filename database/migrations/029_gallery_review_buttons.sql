-- 029 — w mailu z galerią prośba o opinię to dwa przyciski: Google i Facebook
-- (wcześniej jeden link kierujący domyślnie na stronę główną).
SET NAMES utf8mb4;

UPDATE email_templates SET
  body = '<p>Mamy nadzieję, że bawiliście się wyśmienicie! 🎉 Będzie nam ogromnie miło, jeśli poświęcisz chwilę i zostawisz nam opinię — to dla nas największe wsparcie:</p><p style="text-align:center;margin:22px 0;"><a href="https://share.google/soKiNIv4cre1KqRCJ" style="display:inline-block;margin:6px;padding:12px 24px;background:#4285F4;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">⭐ Opinia w Google</a><a href="https://www.facebook.com/mmevents.fotolustro/reviews/?id=100075936099422&amp;sk=reviews" style="display:inline-block;margin:6px;padding:12px 24px;background:#1877F2;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">👍 Opinia na Facebooku</a></p>',
  variables = '[]'
WHERE code = 'review_request';
