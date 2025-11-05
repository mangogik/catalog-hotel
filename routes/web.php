<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CheckoutController; // <-- 1. DITAMBAHKAN
use App\Http\Controllers\XenditController;   // <-- 2. Controller Midtrans dihapus

/*
|--------------------------------------------------------------------------
| Web Routes – Catalog Hotel
|--------------------------------------------------------------------------
*/

// Landing / form token (tetap di CatalogController)
Route::get('/', [CatalogController::class, 'start'])->name('catalog.start');

// Submit token booking (tetap di CatalogController)
Route::post('/enter', [CatalogController::class, 'enter'])->name('catalog.enter');

// Masuk via LINK langsung (tetap di CatalogController)
Route::get('/enter/{token}', [CatalogController::class, 'enterLink'])->name('catalog.enter.link');

// Keluar / Akhiri sesi (tetap di CatalogController)
Route::match(['GET', 'POST'], '/leave', [CatalogController::class, 'logout'])->name('catalog.logout');

// Webhook dari Xendit
Route::post('/xendit/notification', [XenditController::class, 'notification'])->name('xendit.notification');


// Semua route di bawah ini memerlukan sesi booking aktif
Route::middleware('catalog.auth')->group(function () {

    // === RUTE KATALOG (Browsing) ===
    // Halaman katalog (Inertia React page)
    Route::get('/catalog', [CatalogController::class, 'browse'])->name('catalog.browse');
    // Halaman detail service (by slug)
    Route::get('/service/{slug}', [CatalogController::class, 'serviceDetail'])->name('catalog.service.show');


    // === RUTE CHECKOUT (Order) - DIPINDAHKAN KE CheckoutController ===
    // Halaman Checkout (Inertia React Page)
    Route::get('/checkout', [CheckoutController::class, 'checkoutPage'])->name('catalog.checkout.page');
    // Checkout → WhatsApp
    Route::get('/checkout/whatsapp', [CheckoutController::class, 'whatsapp'])->name('catalog.checkout.wa');


    // API endpoints
    Route::prefix('api')->name('catalog.api.')->group(function () {

        // --- API Katalog (Tetap di CatalogController) ---
        Route::get('/services', [CatalogController::class, 'services'])->name('services');
        Route::get('/services/{service}/questions', [CatalogController::class, 'serviceQuestions'])
            ->whereNumber('service')
            ->name('services.questions');
        Route::get('/customers/{customer}/bookings', [CatalogController::class, 'customerActiveBookings'])
            ->whereNumber('customer')
            ->name('customers.bookings');
        Route::get('/eligible-promotions', [CatalogController::class, 'eligiblePromotions'])->name('eligible-promotions');


        // --- API Checkout (DIPINDAHKAN ke CheckoutController) ---
        Route::post('/cart-preview', [CheckoutController::class, 'cartPreview'])->name('cart-preview');
        Route::post('/checkout', [CheckoutController::class, 'checkout'])->name('checkout');
        Route::post('/quick-order/preview', [CheckoutController::class, 'quickOrderPreview'])->name('quick.preview');
        Route::post('/quick-order/checkout', [CheckoutController::class, 'quickOrderCheckout'])->name('quick.checkout');
    });
});

// Debug (local only)
if (app()->environment('local')) {
    Route::get('/__debug/session', function () {
        return response()->json([
            'catalog_booking_id' => session('catalog_booking_id'),
            'catalog_session'    => session('catalog_session'),
        ]);
    })->name('debug.session');

    Route::get('/__ping', function () {
        return Inertia::render('Ping', [
            'message' => 'pong',
            'time'    => now()->toDateTimeString(),
        ]);
    })->name('debug.ping');
}

// Optional fallback
// Route::fallback(fn () => redirect()->route('catalog.start'));