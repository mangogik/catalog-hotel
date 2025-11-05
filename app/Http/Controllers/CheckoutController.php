<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia; // <-- PERBAIKAN: Menambahkan 'use' Inertia
use App\Models\Booking;
use App\Models\Service;
use App\Models\Promotion;
use App\Models\Customer;
use App\Models\Order;
use App\Models\PromotionUsed;
use App\Models\Payment;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class CheckoutController extends Controller
{
    /**
     * Menampilkan halaman Checkout (Inertia React Page)
     */
    public function checkoutPage(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer', 'room.roomType');

        return Inertia::render('Catalog/Checkout', [ // <-- INI MEMBUTUHKAN 'use Inertia\Inertia;'
            'booking' => [
                'id'          => $booking->id,
                'guest'       => $booking->customer?->name,
                'checkin_at'  => $booking->checkin_at?->toIso8601String(),
                'checkout_at' => $booking->checkout_at?->toIso8601String(),
                'room_label'  => $booking->room_label,
                'status'      => $booking->status,
                'customer'    => $booking->customer ? $booking->customer->only(['id', 'name', 'phone']) : null,
                'room'        => $booking->room ? [
                    'id' => $booking->room->id,
                    'room_number' => $booking->room->room_number,
                    'room_type_name' => $booking->room->roomType?->name,
                ] : null,
            ],
        ]);
    }

    /**
     * API: Cart preview (multi item)
     */
    public function cartPreview(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer.membership');

        // =================================================================
        // === 👇 PERBAIKAN VALIDASI 1 DARI 3 ADA DI SINI 👇 ===
        // =================================================================
        $validated = $req->validate([
            'items'                      => ['required', 'array', 'min:1'],
            'items.*.id'                 => ['required', 'exists:services,id'],
            'items.*.quantity'           => ['nullable', 'numeric', 'min:0'],
            'items.*.details.package'    => ['nullable', 'string'],
            // Izinkan 'packages' berupa array (lama) atau objek (baru)
            'items.*.details.packages'   => ['nullable', 'array'], 
            // Hapus 'items.*.details.packages.*' => ['string'],
            'items.*.details.weight'     => ['nullable', 'numeric', 'min:0'],
            'items.*.details.answers'    => ['nullable', 'array'],
            'promotion_id'               => ['nullable', 'exists:promotions,id'],
        ]);
        // =================================================================
        // === 👆 AKHIR PERBAIKAN 1 👆 ===
        // =================================================================

        $lineItems = $this->computeLines($validated['items']);
        $subtotal  = collect($lineItems)->sum(fn($li) => $li['line_total']);

        $discountTotal = 0.0;
        $promoSnapshot = null;

        if (!empty($validated['promotion_id']) && $booking->customer) {
            $promotion = Promotion::with('services:id')->active()->findOrFail($validated['promotion_id']);
            $elig = $this->isPromotionEligibleSimple(
                $promotion,
                $booking->customer,
                collect($lineItems)->pluck('service_id')->all(),
                now()
            );
            if ($elig['ok']) {
                $discountTotal = $this->computeDiscountFromPromotion($promotion, $lineItems, $subtotal);
                $promoSnapshot = [
                    'promotion' => $promotion->only([
                        'id',
                        'name',
                        'type',
                        'discount_percent',
                        'discount_amount',
                        'free_service_id',
                        'free_service_qty',
                        'birthday_days_before',
                        'membership_tier',
                        'event_code'
                    ]),
                    'eligible'  => true,
                ];
            } else {
                $promoSnapshot = ['eligible' => false, 'reason' => $elig['reason']];
            }
        }

        $grandTotal = max($subtotal - $discountTotal, 0);

        return response()->json([
            'lines'          => $lineItems,
            'subtotal'       => $subtotal,
            'discount_total' => $discountTotal,
            'grand_total'    => $grandTotal,
            'promotion'      => $promoSnapshot,
        ]);
    }

    /**
     * API: Cart checkout (multi item)
     */
    public function checkout(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer.membership');

        if (!$booking->customer) {
            return response()->json(['success' => false, 'message' => 'Customer tidak ditemukan untuk booking ini.'], 422);
        }

        // =================================================================
        // === 👇 PERBAIKAN VALIDASI 2 DARI 3 ADA DI SINI 👇 ===
        // =================================================================
        $validated = $req->validate([
            'items'                      => ['required', 'array', 'min:1'],
            'items.*.id'                 => ['required', 'exists:services,id'],
            'items.*.quantity'           => ['nullable', 'numeric', 'min:0'],
            'items.*.details.package'    => ['nullable', 'string'],
            'items.*.details.packages'   => ['nullable', 'array'], // <-- DIUBAH
            // 'items.*.details.packages.*' => ['string'], <-- DIHAPUS
            'items.*.details.weight'     => ['nullable', 'numeric', 'min:0'],
            'items.*.details.answers'    => ['nullable', 'array'],

            'payment_preference'         => ['required', 'string', 'in:cash,online'],
            'promotion_id'               => ['nullable', 'exists:promotions,id'],

            'order_notes'                => ['nullable', 'string', 'max:2000'],
        ]);
        // =================================================================
        // === 👆 AKHIR PERBAIKAN 2 👆 ===
        // =================================================================

        $lineItems = $this->computeLines($validated['items']);
        $subtotal  = collect($lineItems)->sum(fn($li) => $li['line_total']);

        $discountTotal = 0.0;
        $promotionUsedPayload = null;

        if (!empty($validated['promotion_id'])) {
            $promotion = Promotion::with('services:id')->active()->findOrFail($validated['promotion_id']);
            $eligible  = $this->isPromotionEligibleSimple(
                $promotion,
                $booking->customer,
                collect($lineItems)->pluck('service_id')->all(),
                now()
            );

            if (!$eligible['ok']) {
                return response()->json(['success' => false, 'message' => 'Promosi tidak memenuhi syarat: ' . $eligible['reason']], 422);
            }

            $discountTotal = $this->computeDiscountFromPromotion($promotion, $lineItems, $subtotal);

            $promotionUsedPayload = [
                'promotion_id'     => $promotion->id,
                'discount_applied' => $discountTotal,
                'free_service_id'  => $promotion->free_service_id,
                'free_service_qty' => $promotion->free_service_qty ?: 1,
                'snapshot_json'    => [
                    'promotion' => $promotion->only([
                        'id', 'name', 'type', 'discount_percent', 'discount_amount',
                        'free_service_id', 'free_service_qty', 'birthday_days_before',
                        'membership_tier', 'event_code'
                    ]),
                    'customer'  => $booking->customer->only(['id', 'name', 'birth_date'])
                        + ['membership_type' => optional($booking->customer->membership)->membership_type],
                    'services'  => $lineItems,
                    'computed'  => ['subtotal' => $subtotal, 'discount_total' => $discountTotal],
                ],
            ];
        }

        $grandTotal = max($subtotal - $discountTotal, 0);

        [$order, $paymentRecord] = DB::transaction(function () use ($booking, $validated, $lineItems, $subtotal, $discountTotal, $grandTotal, $promotionUsedPayload) {
            $order = Order::create([
                'customer_id'        => $booking->customer->id,
                'booking_id'         => $booking->id,
                'payment_preference' => $validated['payment_preference'],
                'status'             => 'pending',
                'subtotal'           => $subtotal,
                'discount_total'     => $discountTotal,
                'grand_total'        => $grandTotal,
                'notes'              => $validated['order_notes'] ?? null,
            ]);

            $order->update([
                'order_code' => 'ORD-' . $order->id . '-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(4))
            ]);

            foreach ($lineItems as $li) {
                $detailsOnlyOptions = $li['details'];
                $order->services()->attach($li['service_id'], [
                    'quantity'       => $li['quantity'],
                    'price_per_unit' => $li['price_per_unit'],
                    'details'        => json_encode($detailsOnlyOptions),
                    'answers_json'   => $li['answers_data'] ? json_encode($li['answers_data']) : null,
                ]);
            }

            if ($promotionUsedPayload) {
                PromotionUsed::create([
                    'order_id'         => $order->id,
                    'promotion_id'     => $promotionUsedPayload['promotion_id'],
                    'discount_applied' => $promotionUsedPayload['discount_applied'],
                    'free_service_id'  => $promotionUsedPayload['free_service_id'],
                    'free_service_qty' => $promotionUsedPayload['free_service_qty'],
                    'snapshot_json'    => $promotionUsedPayload['snapshot_json'],
                ]);
            }

            $paymentRecord = Payment::create([
                'order_id' => $order->id,
                'method'   => $validated['payment_preference'],
                'amount'   => $grandTotal,
                'currency' => 'IDR',
                'status'   => 'pending',
            ]);

            Log::info('[Catalog.checkout] ORDER_CREATED', [
                'order_id'       => $order->id,
                'order_code'     => $order->order_code,
                'subtotal'       => $subtotal,
                'discount_total' => $discountTotal,
                'grand_total'    => $grandTotal,
                'payment_id'     => $paymentRecord->id,
            ]);

            return [$order, $paymentRecord];
        });

        $xenditInvoiceUrl = null;
        if ($validated['payment_preference'] === 'online' && $grandTotal > 0) {
            $xenditInvoiceUrl = $this->getXenditInvoiceUrl($order);
            
            if (is_null($xenditInvoiceUrl)) {
                return response()->json(['success' => false, 'message' => 'Gagal memulai sesi pembayaran online. Silakan coba lagi.'], 500);
            }
        }

        try {
            $serviceNames = Service::whereIn(
                'id',
                collect($lineItems)->pluck('service_id')->all()
            )->pluck('name', 'id');

            $itemsForWebhook = collect($lineItems)->map(function ($li) use ($serviceNames) {
                return [
                    'service_id'     => $li['service_id'],
                    'service_name'   => $serviceNames[$li['service_id']] ?? null,
                    'quantity'       => $li['quantity'],
                    'price_per_unit' => $li['price_per_unit'],
                    'line_total'     => $li['line_total'],
                    'details'        => $li['details'] ?? null,
                    'answers'        => $li['answers_data'] ?? null,
                ];
            })->values()->all();

            $invoicePayload = [
                'event' => 'ORDER_CREATED',
                'sent_at' => now()->toIso8601String(),
                'invoice' => [
                    'booking_id'    => $booking->id,
                    'booking_token' => $booking->access_token,
                    'guest_name'    => $booking->customer?->name,
                    'guest_phone'   => $booking->customer?->phone,
                    'room_label'    => $booking->room_label,
                    'order_id'       => $order->id,
                    'order_code'     => $order->order_code,
                    'notes'          => $validated['order_notes'] ?? null,
                    'subtotal'       => $subtotal,
                    'discount_total' => $discountTotal,
                    'grand_total'    => $grandTotal,
                    'currency'       => 'IDR',
                    'items'          => $itemsForWebhook,
                    'payment_url'    => $xenditInvoiceUrl,
                    'payment' => [
                        'payment_id'       => $paymentRecord->id,
                        'method'           => $paymentRecord->method,
                        'status'           => $paymentRecord->status,
                        'amount'           => $paymentRecord->amount,
                        'currency'         => $paymentRecord->currency,
                    ],
                    'created_at_iso' => now()->toIso8601String(),
                ]
            ];

            $this->dispatchN8nOrderWebhook($invoicePayload);
        } catch (\Throwable $e) {
            Log::error('[Catalog.checkout] n8n webhook failed', [
                'order_id' => $order->id ?? null,
                'error'    => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success'      => true,
            'order_id'     => $order->id,
            'order_code'   => $order->order_code,
            'payment_id'   => $paymentRecord->id,
            'grand_total'  => $grandTotal,
            'message'      => 'Order berhasil dibuat.',
            'xendit_invoice_url' => $xenditInvoiceUrl,
        ]);
    }

    /**
     * API: Quick Order preview (single item)
     */
    public function quickOrderPreview(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer.membership');

        // =================================================================
        // === 👇 PERBAIKAN VALIDASI 3 DARI 3 ADA DI SINI 👇 ===
        // =================================================================
        $validated = $req->validate([
            'items'                      => ['required', 'array', 'min:1'],
            'items.*.id'                 => ['required', 'exists:services,id'],
            'items.*.quantity'           => ['nullable', 'numeric', 'min:0'],
            'items.*.details.package'    => ['nullable', 'string'],
            'items.*.details.packages'   => ['nullable', 'array'], // <-- DIUBAH
            // 'items.*.details.packages.*' => ['string'], <-- DIHAPUS
            'items.*.details.weight'     => ['nullable', 'numeric', 'min:0'],
            'items.*.details.answers'    => ['nullable', 'array'],
            'promotion_id'               => ['nullable', 'exists:promotions,id'],
        ]);
        // =================================================================
        // === 👆 AKHIR PERBAIKAN 3 👆 ===
        // =================================================================

        $lineItems = $this->computeLines($validated['items']);
        $subtotal  = collect($lineItems)->sum(fn($li) => $li['line_total']);

        $discountTotal = 0.0;
        $promoSnapshot = null;

        if (!empty($validated['promotion_id'])) {
            $promotion = Promotion::with('services:id')->active()->findOrFail($validated['promotion_id']);
            $elig = $this->isPromotionEligibleSimple(
                $promotion,
                $booking->customer,
                collect($lineItems)->pluck('service_id')->all(),
                now()
            );
            if ($elig['ok']) {
                $discountTotal = $this->computeDiscountFromPromotion($promotion, $lineItems, $subtotal);
                $promoSnapshot = [
                    'promotion' => $promotion->only([
                        'id', 'name', 'type', 'discount_percent', 'discount_amount',
                        'free_service_id', 'free_service_qty', 'birthday_days_before',
                        'membership_tier', 'event_code'
                    ]),
                    'eligible'  => true,
                ];
            } else {
                $promoSnapshot = ['eligible' => false, 'reason' => $elig['reason']];
            }
        }

        $grandTotal = max($subtotal - $discountTotal, 0);

        return response()->json([
            'lines'          => $lineItems,
            'subtotal'       => $subtotal,
            'discount_total' => $discountTotal,
            'grand_total'    => $grandTotal,
            'promotion'      => $promoSnapshot,
        ]);
    }

    /**
     * API: Quick Order checkout (single item)
     */
    public function quickOrderCheckout(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer.membership');

        if (!$booking->customer) {
            return response()->json(['success' => false, 'message' => 'Customer tidak ditemukan untuk booking ini.'], 422);
        }

        // Tidak perlu ubah validasi di sini karena 'quickOrderCheckout'
        // tidak mengirim 'items', melainkan 'service_id' dan 'details' di root.
        // Strukturnya berbeda dan sudah benar.
        $validated = $req->validate([
            'service_id'          => ['required', 'exists:services,id'],
            'quantity'            => ['nullable', 'numeric', 'min:0'],
            'details.package'     => ['nullable', 'string'],
            'details.packages'    => ['nullable', 'array'], // <-- Cukup ubah ini
            // 'details.packages.*'  => ['string'], <-- Dan hapus ini
            'details.weight'      => ['nullable', 'numeric', 'min:0'],
            'details.answers'     => ['nullable', 'array'],

            'payment_preference'  => ['required', 'string', 'in:cash,online'],
            'promotion_id'        => ['nullable', 'exists:promotions,id'],

            'order_notes'         => ['nullable', 'string', 'max:2000'],
        ]);

        $items = [[
            'id'       => $validated['service_id'],
            'quantity' => $validated['quantity'] ?? 1,
            'details'  => $validated['details'] ?? [],
        ]];

        $lineItems = $this->computeLines($items);
        $subtotal  = collect($lineItems)->sum(fn($li) => $li['line_total']);

        $discountTotal = 0.0;
        $promotionUsedPayload = null;

        if (!empty($validated['promotion_id'])) {
            $promotion = Promotion::with('services:id')->active()->findOrFail($validated['promotion_id']);
            $eligible  = $this->isPromotionEligibleSimple(
                $promotion,
                $booking->customer,
                collect($lineItems)->pluck('service_id')->all(),
                now()
            );

            if (!$eligible['ok']) {
                return response()->json(['success' => false, 'message' => 'Promosi tidak memenuhi syarat: ' . $eligible['reason']], 422);
            }

            $discountTotal = $this->computeDiscountFromPromotion($promotion, $lineItems, $subtotal);

            $promotionUsedPayload = [
                'promotion_id'     => $promotion->id,
                'discount_applied' => $discountTotal,
                'free_service_id'  => $promotion->free_service_id,
                'free_service_qty' => $promotion->free_service_qty ?: 1,
                'snapshot_json'    => [
                    'promotion' => $promotion->only([
                        'id', 'name', 'type', 'discount_percent', 'discount_amount',
                        'free_service_id', 'free_service_qty', 'birthday_days_before',
                        'membership_tier', 'event_code'
                    ]),
                    'customer'  => $booking->customer->only(['id', 'name', 'birth_date'])
                        + ['membership_type' => optional($booking->customer->membership)->membership_type],
                    'services'  => $lineItems,
                    'computed'  => ['subtotal' => $subtotal, 'discount_total' => $discountTotal],
                ],
            ];
        }

        $grandTotal = max($subtotal - $discountTotal, 0);

        [$order, $paymentRecord] = DB::transaction(function () use ($booking, $validated, $lineItems, $subtotal, $discountTotal, $grandTotal, $promotionUsedPayload) {
            $order = Order::create([
                'customer_id'        => $booking->customer->id,
                'booking_id'         => $booking->id,
                'payment_preference' => $validated['payment_preference'],
                'status'             => 'pending',
                'subtotal'           => $subtotal,
                'discount_total'     => $discountTotal,
                'grand_total'        => $grandTotal,
                'notes'              => $validated['order_notes'] ?? null,
            ]);

            $order->update([
                'order_code' => 'ORD-' . $order->id . '-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(4))
            ]);

            foreach ($lineItems as $li) {
                $detailsOnlyOptions = $li['details'];
                $order->services()->attach($li['service_id'], [
                    'quantity'       => $li['quantity'],
                    'price_per_unit' => $li['price_per_unit'],
                    'details'        => json_encode($detailsOnlyOptions),
                    'answers_json'   => $li['answers_data'] ? json_encode($li['answers_data']) : null,
                ]);
            }

            if ($promotionUsedPayload) {
                PromotionUsed::create([
                    'order_id'         => $order->id,
                    'promotion_id'     => $promotionUsedPayload['promotion_id'],
                    'discount_applied' => $promotionUsedPayload['discount_applied'],
                    'free_service_id'  => $promotionUsedPayload['free_service_id'],
                    'free_service_qty' => $promotionUsedPayload['free_service_qty'],
                    'snapshot_json'    => $promotionUsedPayload['snapshot_json'],
                ]);
            }

            $paymentRecord = Payment::create([
                'order_id' => $order->id,
                'method'   => $validated['payment_preference'],
                'amount'   => $grandTotal,
                'currency' => 'IDR',
                'status'   => 'pending',
            ]);

            Log::info('[Catalog.quickOrderCheckout] ORDER_CREATED', [
                'order_id'       => $order->id,
                'order_code'     => $order->order_code,
                'subtotal'       => $subtotal,
                'discount_total' => $discountTotal,
                'grand_total'    => $grandTotal,
                'payment_id'     => $paymentRecord->id,
            ]);

            return [$order, $paymentRecord];
        });

        $xenditInvoiceUrl = null;
        if ($validated['payment_preference'] === 'online' && $grandTotal > 0) {
            $xenditInvoiceUrl = $this->getXenditInvoiceUrl($order);
            
            if (is_null($xenditInvoiceUrl)) {
                return response()->json(['success' => false, 'message' => 'Gagal memulai sesi pembayaran online. Silakan coba lagi.'], 500);
            }
        }
        
        try {
            $serviceNames = Service::whereIn(
                'id',
                collect($lineItems)->pluck('service_id')->all()
            )->pluck('name', 'id');

            $itemsForWebhook = collect($lineItems)->map(function ($li) use ($serviceNames) {
                return [
                    'service_id'     => $li['service_id'],
                    'service_name'   => $serviceNames[$li['service_id']] ?? null,
                    'quantity'       => $li['quantity'],
                    'price_per_unit' => $li['price_per_unit'],
                    'line_total'     => $li['line_total'],
                    'details'        => $li['details'] ?? null,
                    'answers'        => $li['answers_data'] ?? null,
                ];
            })->values()->all();

            $invoicePayload = [
                'event' => 'ORDER_CREATED',
                'sent_at' => now()->toIso8601String(),
                'invoice' => [
                    'booking_id'    => $booking->id,
                    'booking_token' => $booking->access_token,
                    'guest_name'    => $booking->customer?->name,
                    'guest_phone'   => $booking->customer?->phone,
                    'room_label'    => $booking->room_label,
                    'order_id'       => $order->id,
                    'order_code'     => $order->order_code,
                    'notes'          => $validated['order_notes'] ?? null,
                    'subtotal'       => $subtotal,
                    'discount_total' => $discountTotal,
                    'grand_total'    => $grandTotal,
                    'currency'       => 'IDR',
                    'items'          => $itemsForWebhook,
                    'payment_url'    => $xenditInvoiceUrl,
                    'payment' => [
                        'payment_id'       => $paymentRecord->id,
                        'method'           => $paymentRecord->method,
                        'status'           => $paymentRecord->status,
                        'amount'           => $paymentRecord->amount,
                        'currency'         => $paymentRecord->currency,
                    ],
                    'created_at_iso' => now()->toIso8601String(),
                ]
            ];

            $this->dispatchN8nOrderWebhook($invoicePayload);
        } catch (\Throwable $e) {
            Log::error('[Catalog.quickOrderCheckout] n8n webhook failed', [
                'order_id' => $order->id ?? null,
                'error'    => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success'      => true,
            'order_id'     => $order->id,
            'order_code'   => $order->order_code,
            'payment_id'   => $paymentRecord->id,
            'grand_total'  => $grandTotal,
            'message'      => 'Order berhasil dibuat.',
            'xendit_invoice_url' => $xenditInvoiceUrl,
        ]);
    }

    /**
     * Redirect ke WhatsApp (legacy flow)
     */
    public function whatsapp(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');

        $session  = $req->query('session', session('catalog_session', 'post_checkin'));
        $cartJson = $req->query('cart');
        $cart     = json_decode($cartJson, true);

        if (!$cart || !isset($cart['items']) || !is_array($cart['items'])) {
            Log::warning('[whatsapp] Invalid cart data received.', ['cart_json' => $cartJson, 'booking_id' => $booking->id]);
            return redirect()->route('catalog.browse')->with('error', 'Invalid cart data.');
        }

        $payload = [
            'kind'          => 'CATALOG_ORDER',
            'booking_id'    => $booking->id,
            'booking_token' => $booking->access_token,
            'session'       => $session,
            'items'         => array_map(function ($i) {
                return [
                    'service_id'     => isset($i['service_id']) ? (int)$i['service_id'] : null,
                    'name'           => isset($i['name']) ? substr((string)$i['name'], 0, 100) : 'Unknown Service',
                    'quantity'       => isset($i['quantity']) ? max(1, (int)$i['quantity']) : 1,
                    'price_per_unit' => isset($i['price_per_unit']) ? (float)$i['price_per_unit'] : 0,
                    'details'        => isset($i['details']) && is_array($i['details']) ? $i['details'] : null,
                    'answers'        => isset($i['answers']) && is_array($i['answers']) ? $i['answers'] : null,
                ];
            }, $cart['items']),
            'notes' => isset($cart['notes']) ? substr((string)$cart['notes'], 0, 500) : null,
        ];

        $text  = "*ORDER LAYANAN HOTEL*\n\n";
        $text .= "Booking ID: *" . $booking->id . "*\n";
        $text .= "Nama: *" . $booking->customer?->name . "*\n";
        $text .= "Kamar: *" . $booking->room_label . "*\n";
        $text .= "--------------------\n\n";

        foreach ($payload['items'] as $item) {
            $text .= "*" . $item['name'] . "*\n";
            if (isset($item['details']['package'])) {
                $text .= "  - Pilihan: " . $item['details']['package'] . "\n";
            }
            if (isset($item['details']['weight'])) {
                $text .= "  - Jumlah: " . $item['details']['weight'] . " " . ($item['unit_name'] ?? '') . "\n";
            } else {
                $text .= "  - Kuantitas: " . $item['quantity'] . "\n";
            }
            if (!empty($item['answers'])) {
                $text .= "  - Detail Tambahan:\n";
                $answerLabels = $item['answer_labels'] ?? [];
                foreach ($item['answers'] as $key => $answer) {
                    $label = $answerLabels[$key] ?? str_replace('_', ' ', Str::title($key));
                    if ($answer) {
                        $text .= "    - " . $label . ": " . $answer . "\n";
                    }
                }
            }
            $text .= "\n";
        }

        if ($payload['notes']) {
            $text .= "--------------------\n";
            $text .= "Catatan Tambahan:\n";
            $text .= $payload['notes'] . "\n";
        }

        $phone = config('app.whatsapp_phone', '6282297066642');
        if (str_starts_with($phone, '0')) {
            $phone = '62' . substr($phone, 1);
        }
        $url = 'https://wa.me/' . $phone . '?text=' . urlencode($text);

        Log::info('[whatsapp] Redirecting user to WhatsApp', [
            'booking_id' => $booking->id,
            'item_count' => count($payload['items']),
        ]);

        return redirect()->away($url);
    }

    // ===================================================================
    // =================== PRIVATE HELPER FUNCTIONS ======================
    // ===================================================================

    /**
     * Kirim payload invoice/order ke n8n.
     */
    private function dispatchN8nOrderWebhook(array $payload): void
    {
        try {
            $url = Setting::getValue('n8n_order_webhook_url');
            if (!$url) {
                Log::warning('[n8nWebhook] No n8n_order_webhook_url in settings table.');
                return;
            }

            $response = Http::timeout(10)
                ->retry(2, 100)
                ->post($url, $payload);

            if ($response->successful()) {
                Log::info('[n8nWebhook] delivered successfully', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);
            } else {
                Log::error('[n8nWebhook] delivery failed', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                    'payload' => $payload,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('[n8nWebhook] Exception occurred', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);
        }
    }

    /**
     * Hitung line items (reused).
     */
    private function computeLines(array $servicesPayload): array
    {
        $lineItems = [];
        $serviceIds = collect($servicesPayload)->pluck('id')->unique()->all();
        $servicesById = Service::with('activeQuestion')
            ->whereIn('id', $serviceIds)
            ->get()
            ->keyBy('id');

        foreach ($servicesPayload as $srv) {
            $service = $servicesById->get($srv['id']);
            if (!$service) {
                Log::warning('[computeLines] Service ID not found during bulk fetch: ' . $srv['id']);
                continue;
            }

            $quantity     = (float) ($srv['quantity'] ?? 1);
            $pricePerUnit = (float) $service->price;
            $details      = $srv['details'] ?? [];

            switch ($service->type) {
                case 'selectable': {
                        $packageName = $details['package'] ?? null;
                        if ($packageName) {
                            foreach ((array) $service->options as $option) {
                                if (($option['name'] ?? null) === $packageName) {
                                    $pricePerUnit = (float) ($option['price'] ?? 0);
                                    break;
                                }
                            }
                        }
                        break;
                    }
                case 'multiple_options': {
                        $packages = $details['packages'] ?? [];
                        $sum = 0.0;

                        if (is_array($packages) && !empty($packages)) {
                            $firstValue = reset($packages);
                            $firstKey = key($packages);

                            if (is_numeric($firstKey) && is_string($firstValue)) {
                                // LOGIKA LAMA: ["Nasi Goreng", "Mie Goreng"]
                                foreach ($packages as $n) {
                                    foreach ((array) $service->options as $option) {
                                        if (($option['name'] ?? null) === (string) $n) {
                                            $sum += (float) ($option['price'] ?? 0);
                                            break;
                                        }
                                    }
                                }
                            } else {
                                // LOGIKA BARU: {"Nasi Goreng": 2, "Mie Goreng": 1}
                                foreach ($packages as $packageName => $packageQty) {
                                    $qty = (int) $packageQty;
                                    if ($qty <= 0) continue; 
                                    foreach ((array) $service->options as $option) {
                                        if (($option['name'] ?? null) === (string) $packageName) {
                                            $price = (float) ($option['price'] ?? 0);
                                            $sum += $price * $qty;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        
                        $pricePerUnit = $sum;
                        $quantity = 1;
                        break;
                    }
                case 'per_unit': {
                        $weight       = (float) ($details['weight'] ?? 0);
                        $quantity     = $weight;
                        $pricePerUnit = (float) $service->price;
                        break;
                    }
                case 'free': {
                        $quantity     = 1;
                        $pricePerUnit = 0.0;
                        $details      = [];
                        break;
                    }
                case 'fixed':
                default: {
                        $pricePerUnit = (float) $service->price;
                    }
            }

            if ($service->type !== 'free') {
                $quantity = max($quantity, 0);
            }
            $lineTotal = $pricePerUnit * $quantity;

            $answersData = null;
            if ($service->activeQuestion) {
                $questions = $service->activeQuestion->questions_json;
                $answers   = $details['answers'] ?? [];
                while (count($answers) < count($questions)) {
                    $answers[] = '';
                }
                $answersData = [
                    'questions_snapshot' => $questions,
                    'answers'            => array_slice($answers, 0, count($questions)),
                ];
                unset($details['answers']);
            }

            $lineItems[] = [
                'service_id'     => $service->id,
                'type'           => $service->type,
                'quantity'       => $quantity,
                'price_per_unit' => $pricePerUnit,
                'line_total'     => $lineTotal,
                'details'        => $details,
                'answers_data'   => $answersData,
            ];
        }
        return $lineItems;
    }

    private function isPromotionEligibleSimple(Promotion $p, Customer $customer, array $selectedServiceIds, Carbon $asOf): array
    {
        if (!$p->active) {
            return ['ok' => false, 'reason' => 'Promo inactive'];
        }

        $scopedIds = $p->services->pluck('id')->all();
        if (!empty($scopedIds)) {
            $intersect = array_values(array_intersect($selectedServiceIds, $scopedIds));
            if (empty($intersect)) {
                return ['ok' => false, 'reason' => 'No scoped services selected'];
            }
        }

        if ($p->type === 'birthday') {
            if (!$customer->birth_date) {
                return ['ok' => false, 'reason' => 'No birth date'];
            }
            $daysBefore       = $p->birthday_days_before ?? 3;
            $birthdayThisYear = Carbon::parse($customer->birth_date)->year($asOf->year);
            $diffDays         = $birthdayThisYear->diffInDays($asOf, false);
            $ok               = ($diffDays <= 0) && ($diffDays >= -$daysBefore);
            return ['ok' => $ok, 'reason' => $ok ? null : 'Not in birthday window'];
        }

        if ($p->type === 'membership') {
            $tier = optional($customer->membership)->membership_type;
            $need = $p->membership_tier;
            $ok   = $tier && $need && (strtolower($tier) === strtolower($need));
            return ['ok' => $ok, 'reason' => $ok ? null : 'Membership not matched'];
        }

        return ['ok' => true, 'reason' => null];
    }

    private function computeDiscountFromPromotion(Promotion $p, array $lineItems, float $subtotal): float
    {
        $scopedIds = $p->services->pluck('id')->all();

        $scopeSubtotal = collect($lineItems)
            ->filter(function ($li) use ($scopedIds) {
                return empty($scopedIds) ? true : in_array($li['service_id'], $scopedIds);
            })
            ->sum('line_total');

        $discount = 0.0;

        if (!empty($p->discount_percent)) {
            $pct = max(0, (int) $p->discount_percent);
            $percentDiscount = $scopeSubtotal * ($pct / 100.0);
            $discount += $percentDiscount;
            $scopeSubtotal -= $percentDiscount;
            if ($scopeSubtotal < 0) $scopeSubtotal = 0;
        }

        if (!empty($p->discount_amount)) {
            $amount = (float) $p->discount_amount;
            $discount += min($amount, $scopeSubtotal);
        }

        $discount = max(0, min($discount, $subtotal));

        return round($discount, 2);
    }
    
    private function formatIdr($amount): string
    {
        return 'Rp ' . number_format((float)$amount, 0, ',', '.');
    }

    /**
     * Membuat transaksi Invoice Xendit dan mengembalikan redirect URL.
     */
    private function getXenditInvoiceUrl(Order $order): ?string
    {
        // 1. Muat relasi yang diperlukan
        $order->loadMissing(['booking.customer', 'services', 'payments']);
        $customer = $order->booking?->customer;

        // 2. Ambil Konfigurasi dari database settings
        $secretKey = setting('xendit_secret_key');

        if (empty($secretKey)) {
            Log::error('[Xendit] Gagal: xendit_secret_key belum di-set di Settings.');
            return null; // Gagal jika key tidak ada
        }
        
        // 3. Siapkan Parameter
        $params = [
            'external_id'     => $order->order_code, // Gunakan order_code Anda yang unik
            'amount'          => (int) $order->grand_total,
            'description'     => 'Order ' . $order->order_code . ' for ' . $order->booking?->room_label,
            'customer'        => [
                'given_names' => $customer?->name ?? 'Guest',
                'email'       => $customer?->email ?? 'guest@hotel.com', // Xendit butuh email valid
                'mobile_number' => $customer?->phone ?? '',
            ],
            'success_redirect_url' => route('catalog.browse'), 
            'failure_redirect_url' => route('catalog.checkout.page'),
            'currency'        => 'IDR',
            'items'           => $order->services->map(function ($svc) {
                return [
                    'name'     => substr($svc->name, 0, 255),
                    'quantity' => (int) $svc->pivot->quantity,
                    'price'    => (int) $svc->pivot->price_per_unit,
                ];
            })->values()->all(),
        ];

        // 4. Buat Transaksi
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Basic ' . base64_encode($secretKey . ':')
            ])->post('https://api.xendit.co/v2/invoices', $params);

            if (!$response->successful()) {
                Log::error('[Xendit] Gagal membuat Invoice (API Error)', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'order_id' => $order->id,
                ]);
                return null;
            }

            $invoiceUrl = $response->json('invoice_url');

            // 5. Update payment record dengan external_id
            $payment = $order->payments()->latest()->first();
            if ($payment) {
                $payment->external_id = $order->order_code; 
                $payment->payment_url = $invoiceUrl; 
                $payment->save();
            }

            Log::info('[Xendit] Invoice created', [
                'order_id' => $order->id,
                'order_code' => $order->order_code,
                'invoice_url' => $invoiceUrl,
            ]);

            return $invoiceUrl; // Sukses: kembalikan URL

        } catch (\Exception $e) {
            Log::error('[Xendit] Gagal create transaction (Exception)', [
                'error' => $e->getMessage(),
                'order_id' => $order->id,
                'params' => $params,
            ]);
            return null; // Gagal: kembalikan null
        }
    }
}