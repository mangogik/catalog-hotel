<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user(),
            ],

            // CSRF untuk form non-Inertia atau form biasa
            'csrf_token' => csrf_token(),

            // Flash messages (pakai lazy props agar hanya diambil saat perlu)
            'flash' => [
                'status'  => fn () => $request->session()->get('status'),
                'success' => fn () => $request->session()->get('success'),
                'error'   => fn () => $request->session()->get('error'),
                'message' => fn () => $request->session()->get('message'),
            ],

            // (Opsional) Info sesi katalog, jika ingin diakses dari mana saja
            'catalog' => [
                'booking_id' => fn () => $request->session()->get('catalog_booking_id'),
                'session'    => fn () => $request->session()->get('catalog_session'),
            ],
        ]);
    }
}
