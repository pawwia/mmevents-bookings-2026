<?php

declare(strict_types=1);

use App\Controllers\AdminBookingController;
use App\Controllers\AdminCatalogController;
use App\Controllers\AdminDashboardController;
use App\Controllers\AdminStatsController;
use App\Controllers\AdminAvailabilityController;
use App\Controllers\AdminBlackoutController;
use App\Controllers\AdminDiscountController;
use App\Controllers\AdminLogController;
use App\Controllers\AdminPackageController;
use App\Controllers\AdminSettingsController;
use App\Controllers\AdminTemplateController;
use App\Controllers\AuthController;
use App\Controllers\GoogleOAuthController;
use App\Controllers\OfferController;
use App\Controllers\BookingController;
use App\Controllers\ChatController;
use App\Controllers\PaymentController;
use App\Controllers\PublicController;
use App\Controllers\SigningController;
use App\Controllers\UploadController;
use App\Controllers\WebhookController;
use App\Core\Router;
use App\Middleware\AdminMiddleware;
use App\Middleware\AuthMiddleware;

$router = new Router();

$auth = [AuthMiddleware::class];
$admin = [AuthMiddleware::class, AdminMiddleware::class];

// ---------- Publiczne ----------
$router->get('/api/health', [PublicController::class, 'settings']); // szybki test działania API
$router->get('/api/settings/public', [PublicController::class, 'settings']);
$router->get('/api/packages', [PublicController::class, 'packages']);
$router->get('/api/booking-years', [PublicController::class, 'bookingYears']);
$router->get('/api/availability', [PublicController::class, 'checkDate']);
$router->post('/api/availability/feasibility', [PublicController::class, 'checkFeasibility']);
$router->get('/api/places/autocomplete', [PublicController::class, 'placesAutocomplete']);
$router->get('/api/places/details', [PublicController::class, 'placeDetails']);
$router->post('/api/quote', [PublicController::class, 'quote']);
$router->get('/api/nip', [PublicController::class, 'nipLookup']);
$router->get('/api/catalog/animations', [PublicController::class, 'animations']);
$router->get('/api/catalog/backgrounds', [PublicController::class, 'backgrounds']);
$router->get('/api/catalog/print-templates', [PublicController::class, 'printTemplates']);
$router->get('/api/catalog/guestbook-designs', [PublicController::class, 'guestbookDesigns']);
$router->get('/api/catalog/hashtags', [PublicController::class, 'hashtags']);

// ---------- Auth ----------
$router->post('/api/auth/check-email', [AuthController::class, 'checkEmail']);
$router->post('/api/auth/register', [AuthController::class, 'register']);
$router->post('/api/auth/login', [AuthController::class, 'login']);
$router->post('/api/auth/google', [AuthController::class, 'googleLogin']);
$router->post('/api/auth/verify', [AuthController::class, 'verifyEmail']);
$router->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/api/auth/reset-password', [AuthController::class, 'resetPassword']);
$router->post('/api/auth/resend-verification', [AuthController::class, 'resendVerification'], $auth);
$router->get('/api/auth/me', [AuthController::class, 'me'], $auth);
$router->put('/api/auth/profile', [AuthController::class, 'updateProfile'], $auth);
$router->put('/api/auth/password', [AuthController::class, 'changePassword'], $auth);

// ---------- Klient ----------
$router->post('/api/bookings', [BookingController::class, 'create'], $auth);
$router->get('/api/bookings', [BookingController::class, 'index'], $auth);
$router->get('/api/bookings/{id}', [BookingController::class, 'show'], $auth);
$router->put('/api/bookings/{id}/personalization', [BookingController::class, 'updatePersonalization'], $auth);
$router->post('/api/bookings/{id}/paynow', [PaymentController::class, 'initPayNow'], $auth);

// ---------- Czat klienta ----------
$router->get('/api/bookings/{id}/chat', [ChatController::class, 'bookingThreads'], $auth);
$router->post('/api/bookings/{id}/chat', [ChatController::class, 'createBookingThread'], $auth);
$router->get('/api/chat/threads/{id}', [ChatController::class, 'thread'], $auth);
$router->post('/api/chat/threads/{id}/messages', [ChatController::class, 'postMessage'], $auth);
$router->get('/api/chat/messages/{id}/attachment', [ChatController::class, 'attachment'], $auth);

// ---------- Oferty (publiczna strona + akceptacja) ----------
$router->get('/api/offers/{token}', [OfferController::class, 'show']);
$router->post('/api/offers/{token}/accept', [OfferController::class, 'accept'], $auth);

// ---------- Webhooki ----------
$router->post('/api/webhooks/paynow', [WebhookController::class, 'paynow']);

// ---------- Google OAuth Dysku (callback publiczny — redirect z przeglądarki) ----------
$router->get('/api/google/drive/callback', [GoogleOAuthController::class, 'driveCallback']);

// ---------- Podpisywanie umów — panel klienta (ETAP 2) ----------
$router->get('/api/bookings/{id}/contract', [SigningController::class, 'clientContract'], $auth);
$router->get('/api/bookings/{id}/contract/preview', [SigningController::class, 'clientPreviewPdf'], $auth);
$router->post('/api/bookings/{id}/contract/confirm-read', [SigningController::class, 'clientConfirmRead'], $auth);
$router->post('/api/bookings/{id}/contract/send-code', [SigningController::class, 'clientSendCode'], $auth);
$router->post('/api/bookings/{id}/contract/verify-code', [SigningController::class, 'clientVerifyCode'], $auth);

// ---------- CRM (admin) ----------
$router->get('/api/admin/dashboard', [AdminDashboardController::class, 'index'], $admin);
$router->get('/api/admin/stats', [AdminStatsController::class, 'index'], $admin);
$router->get('/api/admin/clients', [AdminDashboardController::class, 'clients'], $admin);

$router->get('/api/admin/bookings', [AdminBookingController::class, 'index'], $admin);
$router->get('/api/admin/bookings/statuses', [AdminBookingController::class, 'statuses'], $admin);
$router->get('/api/admin/bookings/{id}', [AdminBookingController::class, 'show'], $admin);
$router->patch('/api/admin/bookings/{id}', [AdminBookingController::class, 'update'], $admin);
$router->delete('/api/admin/bookings/{id}', [AdminBookingController::class, 'destroy'], $admin);
$router->patch('/api/admin/bookings/{id}/client', [AdminBookingController::class, 'updateClient'], $admin);
$router->post('/api/admin/bookings/{id}/status', [AdminBookingController::class, 'changeStatus'], $admin);
$router->post('/api/admin/bookings/{id}/deposit-paid', [AdminBookingController::class, 'markDepositPaid'], $admin);
$router->post('/api/admin/bookings/{id}/deposit-unpaid', [AdminBookingController::class, 'unmarkDeposit'], $admin);
$router->post('/api/admin/bookings/{id}/payment', [AdminBookingController::class, 'addPayment'], $admin);
$router->delete('/api/admin/bookings/{id}/payment/{paymentId}', [AdminBookingController::class, 'deletePayment'], $admin);
$router->post('/api/admin/bookings/{id}/gallery', [AdminBookingController::class, 'sendGallery'], $admin);
$router->post('/api/admin/bookings/{id}/personalization-unlock', [AdminBookingController::class, 'setPersonalizationUnlock'], $admin);

// Czat (CRM)
$router->get('/api/admin/chat', [ChatController::class, 'adminThreads'], $admin);
$router->post('/api/admin/bookings/{id}/chat', [ChatController::class, 'adminCreateThread'], $admin);
$router->get('/api/admin/chat/threads/{id}', [ChatController::class, 'adminThread'], $admin);
$router->post('/api/admin/chat/threads/{id}/messages', [ChatController::class, 'adminPostMessage'], $admin);
$router->get('/api/admin/chat/messages/{id}/attachment', [ChatController::class, 'adminAttachment'], $admin);

// Podpisywanie umów — CRM (ETAP 1: właściciel)
$router->get('/api/admin/bookings/{id}/contract', [SigningController::class, 'adminContract'], $admin);
$router->post('/api/admin/bookings/{id}/contract/standard', [SigningController::class, 'generateStandard'], $admin);
$router->post('/api/admin/bookings/{id}/contract/upload', [SigningController::class, 'uploadCustom'], $admin);
$router->get('/api/admin/contracts/{id}/preview', [SigningController::class, 'adminPreviewPdf'], $admin);
$router->get('/api/admin/contracts/{id}/signed-pdf', [SigningController::class, 'adminSignedPdf'], $admin);
$router->post('/api/admin/contracts/{id}/start-signing', [SigningController::class, 'startSigning'], $admin);
$router->post('/api/admin/contracts/{id}/owner/send-code', [SigningController::class, 'ownerSendCode'], $admin);
$router->post('/api/admin/contracts/{id}/owner/verify-code', [SigningController::class, 'ownerVerifyCode'], $admin);
$router->post('/api/admin/contracts/{id}/notify-client', [SigningController::class, 'notifyClient'], $admin);

// Katalogi: {type} = animations | backgrounds | print-templates
$router->get('/api/admin/catalog/{type}', [AdminCatalogController::class, 'index'], $admin);
$router->post('/api/admin/catalog/{type}', [AdminCatalogController::class, 'store'], $admin);
$router->put('/api/admin/catalog/{type}/{id}', [AdminCatalogController::class, 'update'], $admin);
$router->delete('/api/admin/catalog/{type}/{id}', [AdminCatalogController::class, 'destroy'], $admin);

$router->get('/api/admin/packages', [AdminPackageController::class, 'index'], $admin);
$router->post('/api/admin/packages', [AdminPackageController::class, 'store'], $admin);
$router->put('/api/admin/packages/{id}', [AdminPackageController::class, 'update'], $admin);
$router->delete('/api/admin/packages/{id}', [AdminPackageController::class, 'destroy'], $admin);
$router->post('/api/admin/packages/{id}/prices', [AdminPackageController::class, 'upsertPrice'], $admin);
$router->delete('/api/admin/packages/{id}/prices/{priceId}', [AdminPackageController::class, 'deletePrice'], $admin);
$router->post('/api/admin/packages/copy-year', [AdminPackageController::class, 'copyYear'], $admin);

$router->get('/api/admin/discounts', [AdminDiscountController::class, 'index'], $admin);
$router->post('/api/admin/discounts', [AdminDiscountController::class, 'store'], $admin);
$router->put('/api/admin/discounts/{id}', [AdminDiscountController::class, 'update'], $admin);
$router->delete('/api/admin/discounts/{id}', [AdminDiscountController::class, 'destroy'], $admin);

$router->get('/api/admin/email-templates', [AdminTemplateController::class, 'emailIndex'], $admin);
$router->put('/api/admin/email-templates/{id}', [AdminTemplateController::class, 'emailUpdate'], $admin);
$router->get('/api/admin/sms-templates', [AdminTemplateController::class, 'smsIndex'], $admin);
$router->put('/api/admin/sms-templates/{id}', [AdminTemplateController::class, 'smsUpdate'], $admin);

$router->get('/api/admin/settings', [AdminSettingsController::class, 'index'], $admin);
$router->put('/api/admin/settings', [AdminSettingsController::class, 'update'], $admin);
$router->get('/api/admin/settings/audit', [AdminSettingsController::class, 'audit'], $admin);
$router->get('/api/admin/backup', [AdminSettingsController::class, 'backup'], $admin);

$router->get('/api/admin/blackouts', [AdminBlackoutController::class, 'index'], $admin);
$router->post('/api/admin/blackouts', [AdminBlackoutController::class, 'store'], $admin);
$router->delete('/api/admin/blackouts/{id}', [AdminBlackoutController::class, 'destroy'], $admin);

$router->get('/api/admin/availability-checks', [AdminAvailabilityController::class, 'index'], $admin);
$router->get('/api/admin/availability-checks/top-ips', [AdminAvailabilityController::class, 'topIps'], $admin);

$router->get('/api/admin/logs', [AdminLogController::class, 'index'], $admin);
$router->get('/api/admin/logs/emails', [AdminLogController::class, 'emails'], $admin);
$router->get('/api/admin/logs/sms', [AdminLogController::class, 'sms'], $admin);
$router->get('/api/admin/logs/system', [AdminLogController::class, 'systemLog'], $admin);
$router->get('/api/admin/logs/activity', [AdminLogController::class, 'activity'], $admin);
$router->post('/api/admin/logs/process-queue', [AdminLogController::class, 'processQueue'], $admin);
$router->post('/api/admin/logs/retry-failed', [AdminLogController::class, 'retryFailed'], $admin);

$router->get('/api/admin/google/drive/auth-url', [GoogleOAuthController::class, 'driveAuthUrl'], $admin);
$router->post('/api/admin/google/drive/disconnect', [GoogleOAuthController::class, 'driveDisconnect'], $admin);

$router->get('/api/admin/offers', [OfferController::class, 'index'], $admin);
$router->post('/api/admin/offers', [OfferController::class, 'store'], $admin);
$router->put('/api/admin/offers/{id}', [OfferController::class, 'update'], $admin);
$router->delete('/api/admin/offers/{id}', [OfferController::class, 'destroy'], $admin);
$router->post('/api/admin/offers/{id}/send', [OfferController::class, 'send'], $admin);

$router->post('/api/admin/upload', [UploadController::class, 'store'], $admin);

return $router;
