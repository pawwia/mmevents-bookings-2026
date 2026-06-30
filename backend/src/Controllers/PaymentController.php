<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\ActivityLog;
use App\Services\BookingService;
use App\Services\PayNowService;

/** Płatności klienta: PayNow (gdy włączony w CRM); przelew tradycyjny obsługiwany informacyjnie. */
class PaymentController
{
    /** Inicjuje płatność zadatku PayNow. 409 gdy PayNow wyłączony. */
    public function initPayNow(Request $request): Response
    {
        if (!PayNowService::enabled()) {
            return Response::error('Płatności online są obecnie niedostępne — prosimy o przelew tradycyjny', 409);
        }
        $booking = BookingService::find((int) $request->params['id']);
        if ($booking === null || (int) $booking['user_id'] !== $request->userId()) {
            return Response::notFound('Rezerwacja nie istnieje');
        }
        if ($booking['status'] !== 'awaiting_deposit') {
            return Response::error('Rezerwacja nie oczekuje na zadatek', 409);
        }
        $payment = PayNowService::createPayment($booking, $request->user, (float) $booking['deposit_amount']);
        Database::insert('payments', [
            'booking_id' => $booking['id'],
            'type' => 'deposit',
            'method' => 'paynow',
            'amount' => $booking['deposit_amount'],
            'status' => 'pending',
            'paynow_payment_id' => $payment['payment_id'],
        ]);
        ActivityLog::record('payment_started', ['user_id' => $request->userId(), 'booking_id' => $booking['id'], 'ip' => BookingController::clientIp(), 'detail' => 'PayNow — zadatek ' . $booking['deposit_amount'] . ' zł']);
        return Response::json(['redirect_url' => $payment['redirect_url']]);
    }
}
