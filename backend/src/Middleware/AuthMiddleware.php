<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\JwtService;

class AuthMiddleware
{
    public function handle(Request $request): ?Response
    {
        $token = $request->bearerToken();
        $payload = $token ? JwtService::verify($token) : null;
        if ($payload === null) {
            return Response::error('Wymagane uwierzytelnienie', 401);
        }
        $user = Database::selectOne(
            'SELECT id, email, role, first_name, last_name, phone, is_active, email_verified_at FROM users WHERE id = ?',
            [$payload['sub']]
        );
        if ($user === null || !(int) $user['is_active']) {
            return Response::error('Konto nieaktywne', 401);
        }
        $request->user = $user;
        return null;
    }
}
