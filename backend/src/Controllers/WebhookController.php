<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\BookingService;
use App\Services\PayNowService;

/** Webhooki integracji — weryfikowane sygnaturą, idempotentne. */
class WebhookController
{
    /** PayNow: potwierdzenie płatności zadatku. */
    public function paynow(Request $request): Response
    {
        if (!PayNowService::verifyNotification($request->rawBody, $request->header('signature'))) {
            return Response::error('Nieprawidłowa sygnatura', 401);
        }
        $paymentId = (string) $request->input('paymentId', '');
        $status = (string) $request->input('status', '');
        $payment = Database::selectOne('SELECT * FROM payments WHERE paynow_payment_id = ?', [$paymentId]);
        if ($payment === null) {
            return Response::json(['ok' => true]);
        }
        if ($status === 'CONFIRMED' && $payment['status'] !== 'paid') {
            Database::update('payments', ['status' => 'paid', 'paid_at' => date('Y-m-d H:i:s')], 'id = ?', [$payment['id']]);
            BookingService::changeStatus((int) $payment['booking_id'], 'confirmed', null, 'Zadatek opłacony (PayNow)');
        } elseif (in_array($status, ['REJECTED', 'ERROR', 'EXPIRED'], true)) {
            Database::update('payments', ['status' => 'failed'], 'id = ?', [$payment['id']]);
        }
        return Response::json(['ok' => true]);
    }
}
