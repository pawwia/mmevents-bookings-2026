<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\Request;
use App\Core\Response;
use App\Services\ImageService;

/**
 * Upload obrazów (miniatury animacji, tła, szablony wydruków, logo). Multipart pole: file.
 * Opcjonalne pola (szablony wydruków):
 *   - cut_strip=1 — przytnij do jednego paska fotobudkowego (lewa połowa podwójnego szablonu),
 *   - to_webp=1   — zapisz jako WebP (mniejszy rozmiar).
 */
class UploadController
{
    private const ALLOWED = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    private const MAX_BYTES = 8 * 1024 * 1024;

    public function store(Request $request): Response
    {
        $file = $_FILES['file'] ?? null;
        if ($file === null || $file['error'] !== UPLOAD_ERR_OK) {
            return Response::error('Nie przesłano pliku', 422);
        }
        if ($file['size'] > self::MAX_BYTES) {
            return Response::error('Plik jest za duży (maks. 8 MB)', 422);
        }
        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!isset(self::ALLOWED[$mime])) {
            return Response::error('Dozwolone formaty: JPG, PNG, WEBP, GIF', 422);
        }
        $subdir = date('Y/m');
        $dir = App::basePath() . '/public/uploads/' . $subdir;
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            return Response::error('Nie udało się utworzyć katalogu uploadu', 500);
        }

        $cutStrip = (bool) $request->input('cut_strip', false);
        $toWebp = (bool) $request->input('to_webp', false);

        // Przetwarzanie (przycięcie do paska / WebP) — gdy poproszono i GD obsłuży format.
        if ($cutStrip || $toWebp) {
            $processed = ImageService::process($file['tmp_name'], $mime, $dir, $cutStrip, $toWebp);
            if ($processed !== null) {
                return Response::json(['url' => "/uploads/$subdir/{$processed['filename']}"], 201);
            }
            // GD nie obsłużył formatu — zapis bez przetwarzania (poniżej).
        }

        $name = bin2hex(random_bytes(12)) . '.' . self::ALLOWED[$mime];
        if (!move_uploaded_file($file['tmp_name'], "$dir/$name")) {
            return Response::error('Nie udało się zapisać pliku', 500);
        }
        return Response::json(['url' => "/uploads/$subdir/$name"], 201);
    }
}
