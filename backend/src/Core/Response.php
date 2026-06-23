<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public function __construct(
        public readonly mixed $data,
        public readonly int $status = 200,
        public readonly array $headers = [],
    ) {
    }

    public static function json(mixed $data, int $status = 200): self
    {
        return new self($data, $status);
    }

    public static function error(string $message, int $status = 400, array $details = []): self
    {
        return new self(['error' => $message] + ($details ? ['details' => $details] : []), $status);
    }

    public static function notFound(string $message = 'Nie znaleziono zasobu'): self
    {
        return self::error($message, 404);
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');
        foreach ($this->headers as $name => $value) {
            header("$name: $value");
        }
        echo json_encode($this->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
