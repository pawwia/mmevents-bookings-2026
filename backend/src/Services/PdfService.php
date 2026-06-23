<?php

declare(strict_types=1);

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;
use setasign\Fpdi\Fpdi;

/**
 * Generowanie PDF umów lokalnie na serwerze (bez Google):
 *  - Dompdf renderuje HTML → PDF z pełną obsługą polskich znaków (czcionka DejaVu Sans),
 *  - umowy z szablonu HTML: końcowy PDF = treść umowy + strona potwierdzenia (jeden render),
 *  - umowy wgrane jako zewnętrzny PDF: stronę potwierdzenia dokładamy przez FPDI.
 */
final class PdfService
{
    /** Renderuje HTML do PDF (A4). */
    public static function htmlToPdf(string $html): string
    {
        $options = new Options();
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->setChroot(sys_get_temp_dir());

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->render();
        return $dompdf->output();
    }

    /** Umowa z szablonu HTML: treść + strona potwierdzenia w jednym dokumencie. */
    public static function buildSignedFromHtml(string $contractHtml, array $data): string
    {
        // Nadruk podpisu (numer umowy + hash) na każdej stronie — Dompdf powtarza position:fixed.
        $html = self::stampBarHtml($data)
            . $contractHtml
            . '<div style="page-break-before: always;"></div>'
            . self::confirmationHtml($data);
        return self::htmlToPdf($html);
    }

    /**
     * Umowa wgrana jako PDF: dołącza stronę potwierdzenia (Dompdf) na końcu.
     * Każda strona dostaje nadruk podpisu (numer umowy + skrót hasha + data).
     * @return array{bytes:string, merged:bool}
     */
    public static function buildSignedFromPdf(string $contractPdf, array $data): array
    {
        $confirmationPdf = self::htmlToPdf(self::confirmationHtml($data));
        try {
            return ['bytes' => self::merge([$contractPdf, $confirmationPdf], self::stampText($data)), 'merged' => true];
        } catch (\Throwable $e) {
            // PDF nieobsługiwany przez FPDI (np. 1.5+ z kompresją xref) — zwracamy samą stronę
            // potwierdzenia; oryginał zostanie dołączony do e-maila osobno.
            error_log('PdfService merge: ' . $e->getMessage());
            return ['bytes' => $confirmationPdf, 'merged' => false];
        }
    }

    /** Scala wiele dokumentów PDF w jeden (FPDI), opcjonalnie z nadrukiem podpisu na każdej stronie. */
    private static function merge(array $pdfBlobs, ?string $stamp = null): string
    {
        $pdf = new Fpdi();
        // Strony dodajemy ręcznie (po jednej na importowaną stronę). Bez tego nadruk przy dolnej
        // krawędzi przekracza domyślny próg page-break i FPDF dorzuca pustą stronę z tekstem na górze.
        $pdf->SetAutoPageBreak(false);
        $tmps = [];
        try {
            foreach ($pdfBlobs as $blob) {
                $tmp = tempnam(sys_get_temp_dir(), 'mme_merge_');
                file_put_contents($tmp, $blob);
                $tmps[] = $tmp;
                $pageCount = $pdf->setSourceFile($tmp);
                for ($page = 1; $page <= $pageCount; $page++) {
                    $template = $pdf->importPage($page);
                    $size = $pdf->getTemplateSize($template);
                    $pdf->AddPage($size['width'] > $size['height'] ? 'L' : 'P', [$size['width'], $size['height']]);
                    $pdf->useTemplate($template);
                    if ($stamp !== null && $stamp !== '') {
                        self::stampPage($pdf, (float) $size['width'], (float) $size['height'], $stamp);
                    }
                }
            }
            return $pdf->Output('S');
        } finally {
            foreach ($tmps as $tmp) {
                @unlink($tmp);
            }
        }
    }

    /** Nadruk podpisu w stopce strony (FPDF — czcionka rdzeniowa, tekst ASCII-bezpieczny). */
    private static function stampPage(Fpdi $pdf, float $width, float $height, string $stamp): void
    {
        $pdf->SetFont('Helvetica', '', 7);
        $pdf->SetTextColor(120, 120, 120);
        $pdf->SetXY(8, $height - 7);
        // iconv: usuń polskie znaki diakrytyczne (FPDF nie obsługuje UTF-8 w czcionkach rdzeniowych)
        $safe = @iconv('UTF-8', 'ASCII//TRANSLIT', $stamp) ?: $stamp;
        $pdf->Cell($width - 16, 4, $safe, 0, 0, 'C');
    }

    /** Krótki tekst nadruku: „Podpisano elektronicznie (SMS OTP) - {numer} - {hash} - {data}". */
    private static function stampText(array $data): string
    {
        $shortHash = substr((string) ($data['hash'] ?? ''), 0, 12);
        $date = (string) ($data['client_signed_at'] ?? $data['owner_signed_at'] ?? '');
        return trim(sprintf(
            'Podpisano elektronicznie (SMS OTP)  -  Umowa %s  -  %s%s',
            (string) ($data['numer_umowy'] ?? ''),
            $shortHash !== '' ? "ID $shortHash  -  " : '',
            $date
        ));
    }

    /** Nadruk podpisu jako pasek na dole każdej strony (Dompdf — pełne polskie znaki). */
    private static function stampBarHtml(array $data): string
    {
        $shortHash = substr((string) ($data['hash'] ?? ''), 0, 12);
        $date = (string) ($data['client_signed_at'] ?? $data['owner_signed_at'] ?? '');
        $parts = array_filter([
            'Podpisano elektronicznie (SMS OTP)',
            'Umowa ' . ($data['numer_umowy'] ?? ''),
            $shortHash !== '' ? 'ID ' . $shortHash : null,
            $date !== '' ? $date : null,
        ]);
        return '<div style="position: fixed; bottom: 6px; left: 0; right: 0; text-align: center;
            font-family: DejaVu Sans, sans-serif; font-size: 7px; color: #888;
            border-top: 0.5px solid #ccc; padding-top: 2px;">'
            . htmlspecialchars(implode('  •  ', $parts))
            . '</div>';
    }

    /** HTML strony potwierdzenia podpisu (dane dowodowe). */
    public static function confirmationHtml(array $data): string
    {
        $rows = static function (array $pairs): string {
            $html = '';
            foreach ($pairs as [$label, $value]) {
                $html .= '<tr><td class="l">' . htmlspecialchars((string) $label) . '</td><td>'
                    . htmlspecialchars((string) $value) . '</td></tr>';
            }
            return $html;
        };

        $main = $rows([
            ['Numer umowy', $data['numer_umowy'] ?? ''],
            ['Hash dokumentu (SHA-256)', $data['hash'] ?? ''],
            ['Data wygenerowania dokumentu', $data['generated_at'] ?? ''],
        ]);
        $owner = $rows([
            ['Data i godzina', $data['owner_signed_at'] ?? ''],
            ['Numer telefonu', $data['owner_phone'] ?? ''],
            ['Adres IP', $data['owner_ip'] ?? ''],
            ['Identyfikator OTP', $data['owner_otp'] ?? ''],
        ]);
        $client = $rows([
            ['Data i godzina', $data['client_signed_at'] ?? ''],
            ['Numer telefonu', $data['client_phone'] ?? ''],
            ['Adres IP', $data['client_ip'] ?? ''],
            ['Identyfikator OTP', $data['client_otp'] ?? ''],
        ]);

        return '<style>
          .conf { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1a1a1a; }
          .conf h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
          .conf .sub { text-align: center; color: #666; font-size: 10px; margin-bottom: 14px; }
          .conf h2 { font-size: 12px; margin: 14px 0 4px; }
          .conf table { width: 100%; border-collapse: collapse; }
          .conf td { padding: 3px 4px; vertical-align: top; word-break: break-word; }
          .conf td.l { width: 40%; color: #555; }
          .conf .note { margin-top: 18px; font-size: 9px; color: #777; font-style: italic; }
        </style>
        <div class="conf">
          <h1>Potwierdzenie podpisu elektronicznego</h1>
          <div class="sub">Podpis złożony dwuetapowo kodem SMS (jednorazowe hasło OTP)</div>
          <table>' . $main . '</table>
          <h2>Podpis właściciela (mmevents.pl)</h2>
          <table>' . $owner . '</table>
          <h2>Podpis klienta</h2>
          <table>' . $client . '</table>
          <p class="note">Niniejsza strona stanowi integralną część umowy i potwierdza złożenie podpisów
          elektronicznych obu stron poprzez weryfikację jednorazowymi kodami SMS. Hash SHA-256 jednoznacznie
          identyfikuje treść podpisanego dokumentu i nie ulega zmianie po rozpoczęciu procesu podpisywania.</p>
        </div>';
    }
}
