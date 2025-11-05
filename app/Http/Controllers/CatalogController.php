<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
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

class CatalogController extends Controller
{
    /**
     * Helper: bangun URL publik untuk image service.
     */
    private function imagePublicUrl(?string $path, ?string $accessorUrl = null): ?string
    {
        if ($accessorUrl) {
            return $accessorUrl;
        }
        if (!$path) {
            return null;
        }
        $base = config('app.dashboard_asset_base', config('app.url'));
        return rtrim($base, '/') . '/storage/' . ltrim($path, '/');
    }

    /**
     * Landing (form token).
     */
    public function start(Request $req)
    {
        if ($req->filled('token')) {
            $token   = $req->query('token');
            $booking = Booking::where('access_token', $token)->first();

            if ($booking) {
                session([
                    'catalog_booking_id' => $booking->id,
                    'catalog_session'    => $this->detectSession($booking),
                ]);
                return redirect()->route('catalog.browse');
            }

            return redirect()->route('catalog.start')
                ->withErrors(['token' => 'Token tidak valid.']);
        }

        return Inertia::render('Catalog/Start', [
            'csrf_token' => csrf_token(),
            'flash' => [
                'status' => session('status'),
            ]
        ]);
    }

    /**
     * Submit token dari form.
     */
    public function enter(Request $req)
    {
        $data = $req->validate(['token' => 'required|string']);

        $booking = Booking::where('access_token', $data['token'])->first();
        if (!$booking) {
            return back()->withErrors(['token' => 'Token tidak valid.']);
        }

        session([
            'catalog_booking_id' => $booking->id,
            'catalog_session'    => $this->detectSession($booking),
        ]);

        return redirect()->route('catalog.browse');
    }

    /**
     * Masuk via tautan langsung: /enter/{token}
     */
    public function enterLink(Request $req, string $token)
    {
        $booking = Booking::where('access_token', $token)->first();
        if (!$booking) {
            return redirect()->route('catalog.start')
                ->withErrors(['token' => 'Token tidak valid atau sudah kedaluwarsa.']);
        }

        session([
            'catalog_booking_id' => $booking->id,
            'catalog_session'    => $this->detectSession($booking),
        ]);

        return redirect()->route('catalog.browse');
    }

    /**
     * Halaman katalog (Inertia).
     */
    public function browse(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer', 'room.roomType');
        $session = session('catalog_session', 'post_checkin');

        return Inertia::render('Catalog/Catalog', [
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
            'session' => $session,
        ]);
    }

    /**
     * API daftar layanan untuk FE katalog.
     */
    public function services(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');

        $requested      = $req->query('session');
        $defaultSession = session('catalog_session', $this->detectSession($booking));

        if ($requested === 'auto') {
            $sessions = ['pre_checkin', 'post_checkin', 'pre_checkout'];
        } else {
            $pick     = $requested ?: $defaultSession;
            $sessions = [$pick];
        }

        $services = Service::with([
            'activeQuestion',
            'images',
            'optionImages',
            'category:id,name,slug'
        ])
            ->whereIn('offering_session', $sessions)
            ->orderBy('offering_session')
            ->orderBy('name')
            ->get()
            ->map(function ($s) {
                // normalize options
                $options = $s->options;
                if (is_string($options)) {
                    $decoded = json_decode($options, true);
                    $options = is_array($decoded) ? $decoded : [];
                } elseif (!is_array($options)) {
                    $options = [];
                }

                // normalize questions
                $questions = $s->activeQuestion?->questions_json;
                if (is_string($questions)) {
                    $decoded = json_decode($questions, true);
                    $questions = is_array($decoded) ? $decoded : [];
                } elseif (!is_array($questions)) {
                    $questions = [];
                }

                // general images
                $generalImages = $s->images->map(function ($img) {
                    return [
                        'id'      => $img->id,
                        'caption' => $img->caption,
                        'url'     => $this->imagePublicUrl(
                            $img->image_path,
                            method_exists($img, 'getUrlAttribute') ? $img->url : null
                        ),
                    ];
                })->values();

                // option images
                $optionImgsRaw = $s->optionImages->map(function ($img) {
                    return [
                        'id'          => $img->id,
                        'option_key'  => $img->option_key,
                        'option_name' => $img->option_name,
                        'caption'     => $img->caption,
                        'url'         => $this->imagePublicUrl(
                            $img->image_path,
                            method_exists($img, 'getUrlAttribute') ? $img->url : null
                        ),
                    ];
                })->values();

                $optionImagesGrouped = [];
                foreach ($optionImgsRaw as $oi) {
                    $key = $oi['option_key'] ?? 'unknown';
                    $nameKey = $oi['option_name'] ?? 'unknown';
                    if (!isset($optionImagesGrouped[$key])) {
                        $optionImagesGrouped[$key] = [];
                    }
                    $optionImagesGrouped[$key][] = $oi;
                    if ($nameKey !== $key && !isset($optionImagesGrouped[$nameKey])) {
                        $optionImagesGrouped[$nameKey] = [];
                        $optionImagesGrouped[$nameKey][] = $oi;
                    }
                }

                return [
                    'id'               => $s->id,
                    'slug'             => $s->slug,
                    'name'             => $s->name,
                    'description'      => $s->description, 
                    'description_html' => $s->description_html, // <-- Ini field baru Anda
                    'type'             => $s->type,
                    'fulfillment_type' => $s->fulfillment_type,
                    'unit_name'        => $s->unit_name,
                    'price'            => $s->price,
                    'offering_session' => $s->offering_session,
                    'category' => $s->category ? [
                        'id' => $s->category->id,
                        'name' => $s->category->name,
                        'slug' => $s->category->slug,
                    ] : null,
                    'options'          => $options,
                    'active_question'  => $s->activeQuestion
                        ? ['questions_json' => $questions]
                        : null,
                    'images'           => $generalImages,
                    'option_images'    => $optionImagesGrouped,
                ];
            });

        $allCategories = \App\Models\ServiceCategory::orderBy('name')->get(['id', 'name', 'slug']);

        return response()->json([
            'services'       => $services,
            'categories'     => $allCategories,
            'sessions'       => $sessions,
            'booking_status' => $booking->status,
        ]);
    }

    /**
     * Halaman detail service.
     */
    public function serviceDetail(Request $req, string $slug)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer', 'room.roomType');

        $service = Service::with([
            'activeQuestion',
            'images',
            'optionImages',
        ])
            ->where('slug', $slug)
            ->firstOrFail();

        $generalImages = $service->images->map(function ($img) {
            return $this->imagePublicUrl(
                $img->image_path,
                method_exists($img, 'getUrlAttribute') ? $img->url : null
            );
        })->filter()->values()->all();

        $gallery = count($generalImages)
            ? $generalImages
            : [
                "https://images.unsplash.com/photo-1501117716987-c8e19bcd90b7?q=80&w=1600&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1496412705862-e0088f16f791?q=80&w=1600&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1481833761820-0509d3217039?q=80&w=1600&auto=format&fit=crop",
            ];

        $options = $service->options;
        if (is_string($options)) {
            $decoded = json_decode($options, true);
            $options = is_array($decoded) ? $decoded : [];
        } elseif (!is_array($options)) {
            $options = [];
        }

        $questions = $service->activeQuestion?->questions_json;
        if (is_string($questions)) {
            $decoded = json_decode($questions, true);
            $questions = is_array($decoded) ? $decoded : [];
        } elseif (!is_array($questions)) {
            $questions = [];
        }

        return Inertia::render('Catalog/ServiceDetail', [
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
            'service' => [
                'id'               => $service->id,
                'slug'             => $service->slug,
                'name'             => $service->name,
                'description'      => $service->description,
                'description_html' => $service->description_html, // <-- Ini field baru Anda
                'type'             => $service->type,
                'fulfillment_type' => $service->fulfillment_type,
                'unit_name'        => $service->unit_name,
                'price'            => $service->price,
                'offering_session' => $service->offering_session,
                'options'          => $options,
                'active_question'  => $service->activeQuestion
                    ? ['questions_json' => $questions]
                    : null,
                'option_images'    => $service->optionImages->map(function ($img) {
                    return [
                        'option_key'  => $img->option_key,
                        'option_name' => $img->option_name,
                        'url'         => $this->imagePublicUrl(
                            $img->image_path,
                            method_exists($img, 'getUrlAttribute') ? $img->url : null
                        ),
                    ];
                })->values(),
            ],
            'gallery'        => $gallery,
            'header_session' => $this->detectSession($booking),
        ]);
    }

    /**
     * API promo eligible.
     */
    public function eligiblePromotions(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');
        $booking->loadMissing('customer.membership');
        $customer  = $booking->customer;
        $serviceId = $req->query('service_id');

        if (!$customer) {
            Log::warning('[eligiblePromotions] Customer missing.', ['booking_id' => $booking->id]);
            return response()->json(['promotions' => []]);
        }

        $now = now();

        $promos = Promotion::with('services:id')->active()->get();

        $freeIds = $promos->pluck('free_service_id')->filter()->unique()->values()->all();
        $freeNameMap = $freeIds
            ? \App\Models\Service::whereIn('id', $freeIds)->pluck('name', 'id')->toArray()
            : [];

        $eligiblePromos = $promos
            ->filter(function (Promotion $promo) use ($customer, $now, $serviceId) {
                $elig = $this->isPromotionEligibleForCustomer($promo, $customer, $now);
                if (!$elig['ok']) return false;

                if ($serviceId) {
                    $scoped = $promo->services->pluck('id')->all();
                    if (!empty($scoped) && !in_array((int)$serviceId, $scoped, true)) return false;
                }
                return true;
            })
            ->map(function (Promotion $promo) use ($freeNameMap) {
                $badge = null;
                $desc  = null;

                if ($promo->free_service_id) {
                    $svcName = $freeNameMap[$promo->free_service_id] ?? 'Selected Service';
                    $qty     = max(1, (int)($promo->free_service_qty ?? 1));
                    $badge   = $qty > 1 ? "Free {$qty}× {$svcName}" : "Free {$svcName}";
                    $desc    = $badge;
                }

                if ($promo->discount_percent) {
                    $pct   = (int)$promo->discount_percent;
                    $badge = "{$pct}% Discount";
                    $desc  = trim(($desc ? $desc . ' + ' : '') . "{$pct}% off");
                }

                if ($promo->discount_amount) {
                    $amt    = $this->formatIdr($promo->discount_amount);
                    if (!$promo->discount_percent) $badge = "{$amt} Off";
                    $desc   = trim(($desc ? $desc . ' + ' : '') . "{$amt} off");
                }

                if (!$badge) $badge = 'Offer';
                if (!$desc)  $desc  = 'Special Offer';

                return [
                    'id'                 => $promo->id,
                    'name'               => $promo->name,
                    'type'               => $promo->type,
                    'badge_text'         => $badge,
                    'offer_description'  => $desc,
                    'discount_percent'   => $promo->discount_percent,
                    'discount_amount'    => $promo->discount_amount,
                    'free_service_id'    => $promo->free_service_id,
                    'free_service_qty'   => $promo->free_service_qty,
                    'scoped_service_ids' => $promo->services->pluck('id')->all(),
                ];
            })
            ->values();

        return response()->json(['promotions' => $eligiblePromos]);
    }

    /**
     * Akhiri sesi katalog (logout).
     */
    public function logout(Request $req)
    {
        $req->session()->forget(['catalog_booking_id', 'catalog_session']);
        return redirect()->route('catalog.start')
            ->with('status', 'Sesi katalog diakhiri. Anda dapat memasukkan token lain.');
    }

    public function serviceQuestions(Request $req, int $id)
    {
        $service = Service::with('activeQuestion')->findOrFail($id);
        $questions = $service->activeQuestion?->questions_json;

        if (is_string($questions)) {
            $decoded = json_decode($questions, true);
            $questions = is_array($decoded) ? $decoded : [];
        } elseif (!is_array($questions)) {
            $questions = [];
        }

        return response()->json($questions);
    }

    public function customerActiveBookings(Request $req, int $customerId)
    {
        $onlyActive = $req->boolean('onlyActive', false);

        $q = Booking::where('customer_id', $customerId)->latest();
        if ($onlyActive) {
            $q->whereIn('status', ['reserved', 'checked_in']);
        }

        $bookings = $q->get([
            'id',
            'status',
            'checkin_at',
            'checkout_at',
            'room_label'
        ]);

        return response()->json(['bookings' => $bookings]);
    }

    public function ordersForBooking(Request $req)
    {
        /** @var \App\Models\Booking $booking */
        $booking = $req->attributes->get('booking');

        $orders = Order::with([
            'services:id,name',
            'payments' => fn($q) => $q->latest(),
            'promotionsUsed.promotion'
        ])
            ->where('booking_id', $booking->id)
            ->latest()
            ->paginate(10)
            ->withQueryString();

        return response()->json([
            'orders' => $orders
        ]);
    }

    // ===================================================================
    // =================== PRIVATE HELPER FUNCTIONS ======================
    // ===================================================================

    private function detectSession($booking)
    {
        if (!$booking) return 'post_checkin';

        $now = now();
        $checkinThreshold = $booking->checkin_at ? Carbon::parse($booking->checkin_at)->subHour() : null;
        $checkoutThreshold = $booking->checkout_at ? Carbon::parse($booking->checkout_at)->addHour() : null;

        if ($booking->status === 'checked_in') return 'post_checkin';
        if ($booking->status === 'reserved' || ($checkinThreshold && $now->lt($checkinThreshold))) return 'pre_checkin';

        if ($checkinThreshold && $checkoutThreshold && $now->between($checkinThreshold, $checkoutThreshold)) return 'post_checkin';
        if (
            $booking->status === 'checked_out' ||
            $booking->status === 'cancelled' ||
            ($checkoutThreshold && $now->gt($checkoutThreshold))
        ) {
            return 'pre_checkout';
        }

        Log::warning('[detectSession] Could not determine session accurately', [
            'booking_id' => $booking->id,
            'status' => $booking->status,
            'checkin' => $booking->checkin_at,
            'checkout' => $booking->checkout_at
        ]);
        return 'post_checkin';
    }

    private function isPromotionEligibleForCustomer(Promotion $p, Customer $customer, Carbon $asOf): array
    {
        if (!$p->active) {
            return ['ok' => false, 'reason' => 'Promo inactive'];
        }

        if ($p->type === 'birthday') {
            if (!$customer->birth_date) {
                return ['ok' => false, 'reason' => 'Customer has no birth date'];
            }
            try {
                $birthDate = Carbon::parse($customer->birth_date);
                if (!$birthDate->isValid()) {
                    return ['ok' => false, 'reason' => 'Customer has invalid birth date'];
                }

                $daysBefore       = $p->birthday_days_before ?? 3;
                $birthdayThisYear = $birthDate->copy()->year($asOf->year);

                if ($birthdayThisYear->lt($asOf->copy()->subDays($daysBefore))) {
                    $birthdayThisYear->addYear();
                }

                $diffDays = $birthdayThisYear->diffInDays($asOf, false);
                $ok       = ($diffDays >= -$daysBefore) && ($diffDays <= 0);

                return ['ok' => $ok, 'reason' => $ok ? null : 'Not within birthday window'];
            } catch (\Exception $e) {
                Log::warning('Birthday promo check failed', [
                    'promo_id'    => $p->id,
                    'customer_id' => $customer->id,
                    'error'       => $e->getMessage()
                ]);
                return ['ok' => false, 'reason' => 'Error checking birth date'];
            }
        }

        if ($p->type === 'membership') {
            $tier = optional($customer->membership)->membership_type;
            $need = $p->membership_tier;
            $ok   = $tier && $need && (strtolower($tier) === strtolower($need));
            return ['ok' => $ok, 'reason' => $ok ? null : 'Membership tier not matched'];
        }

        return ['ok' => true, 'reason' => null];
    }

    private function formatIdr($amount): string
    {
        return 'Rp ' . number_format((float)$amount, 0, ',', '.');
    }
}