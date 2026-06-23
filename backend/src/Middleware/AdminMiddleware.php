<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;

/** Wymaga roli admin — stosowany po AuthMiddleware na trasach /api/admin/*. */
class AdminMiddleware
{
    public function handle(Request $request): ?Response
    {
        if (!$request->isAdmin()) {
            return Response::error('Brak uprawnień administratora', 403);
        }
        return null;
    }
}
