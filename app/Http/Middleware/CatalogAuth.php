<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\Booking;

class CatalogAuth {
  public function handle(Request $request, Closure $next) {
    // booking_id diset saat POST /enter
    $bookingId = session('catalog_booking_id');
    if (!$bookingId) return redirect()->route('catalog.start');

    // optional: cache booking ringkas di session
    $booking = Booking::with('customer')->find($bookingId);
    if (!$booking) return redirect()->route('catalog.start');

    // inject ke request untuk dipakai controller
    $request->attributes->set('booking', $booking);
    return $next($request);
  }
}
