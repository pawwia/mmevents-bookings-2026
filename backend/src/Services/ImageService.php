<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Przetwarzanie obrazów szablonów wydruków (GD):
 *  - konwersja do WebP (mały rozmiar, dobra jakość) — odciąża dysk i przyspiesza ładowanie u gości,
 *  - „przekrojenie" szablonu na pół (paski fotobudkowe): wydruk jest podwójny (dwa identyczne paski),
 *    drukarka rozcina go wzdłuż dłuższej krawędzi — zostawiamy jeden pasek. Cięcie zależy od orientacji:
 *    obraz pionowy → lewa połowa, obraz poziomy → górna połowa (zawsze wzdłuż dłuższej krawędzi).
 *
 * Działa najlepiej, gdy GD ma wsparcie WebP. Gdy go brak — zapisuje w oryginalnym formacie
 * (przycięcie nadal działa). Animowane GIF-y nie są przetwarzane (zwracamy oryginał).
 */
final class ImageService
{
    /** Mapowanie MIME → rozszerzenie dla formatów obsługiwanych przez przetwarzanie GD. */
    private const LOADERS = [
        'image/jpeg' => 'imagecreatefromjpeg',
        'image/png' => 'imagecreatefrompng',
        'image/webp' => 'imagecreatefromwebp',
    ];

    public static function webpSupported(): bool
    {
        return function_exists('imagewebp') && function_exists('imagecreatetruecolor');
    }

    /**
     * Przetwarza plik obrazu i zapisuje wynik w katalogu docelowym.
     *
     * @param string $srcPath   ścieżka do pliku źródłowego (np. tmp uploadu)
     * @param string $mime      MIME źródła
     * @param string $destDir   katalog docelowy (musi istnieć)
     * @param bool   $cutStrip  czy przyciąć do lewej połowy (jeden pasek)
     * @param bool   $toWebp    czy zapisać jako WebP
     * @param int    $quality   jakość WebP (0–100)
     * @return array{filename:string, ext:string}|null  null, gdy GD nie obsłużył formatu
     */
    public static function process(
        string $srcPath,
        string $mime,
        string $destDir,
        bool $cutStrip,
        bool $toWebp,
        int $quality = 82,
    ): ?array {
        if (!isset(self::LOADERS[$mime]) || !function_exists('imagecreatetruecolor')) {
            return null; // nieobsługiwany format (np. GIF) lub brak GD — zapis bez przetwarzania
        }
        $loader = self::LOADERS[$mime];
        $img = @$loader($srcPath);
        if ($img === false) {
            return null;
        }

        if ($cutStrip) {
            $img = self::cutHalfAlongLongerEdge($img);
        }

        $useWebp = $toWebp && self::webpSupported();
        $ext = $useWebp ? 'webp' : self::extForMime($mime);
        $filename = bin2hex(random_bytes(12)) . '.' . $ext;
        $path = rtrim($destDir, '/') . '/' . $filename;

        $ok = $useWebp
            ? imagewebp($img, $path, $quality)
            : self::saveOriginalFormat($img, $path, $mime, $quality);
        imagedestroy($img);

        return $ok ? ['filename' => $filename, 'ext' => $ext] : null;
    }

    /**
     * Zwraca jeden pasek z podwójnego szablonu — cięcie wzdłuż dłuższej krawędzi:
     *  - obraz pionowy (wyższy niż szerszy) → lewa połowa,
     *  - obraz poziomy (szerszy niż wyższy) → górna połowa.
     * Zachowuje przezroczystość.
     */
    private static function cutHalfAlongLongerEdge(\GdImage $img): \GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        if ($w >= $h) {
            $cw = $w;                       // poziomy: pełna szerokość, górna połowa wysokości
            $ch = max(1, intdiv($h, 2));
        } else {
            $cw = max(1, intdiv($w, 2));    // pionowy: lewa połowa szerokości, pełna wysokość
            $ch = $h;
        }
        $dst = imagecreatetruecolor($cw, $ch);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
        imagefilledrectangle($dst, 0, 0, $cw, $ch, $transparent);
        imagecopy($dst, $img, 0, 0, 0, 0, $cw, $ch);
        imagedestroy($img);
        return $dst;
    }

    private static function saveOriginalFormat(\GdImage $img, string $path, string $mime, int $quality): bool
    {
        return match ($mime) {
            'image/jpeg' => imagejpeg($img, $path, $quality),
            'image/png' => imagepng($img, $path),
            'image/webp' => self::webpSupported() ? imagewebp($img, $path, $quality) : imagepng($img, $path),
            default => false,
        };
    }

    private static function extForMime(string $mime): string
    {
        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'png',
        };
    }
}
