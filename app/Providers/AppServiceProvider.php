<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use App\Models\Setting;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Optimize Vite prefetching for better dev performance
        Vite::prefetch(concurrency: 3);

        /**
         * 🌐 Share global settings (branding, contact, etc.)
         * with all Inertia pages across the app.
         */
        Inertia::share('site', function () {
            // read once from DB
            $settings = Setting::query()
                ->whereIn('key', [
                    'hotel_name',
                    'hotel_tagline',
                    'hotel_logo_url',
                    'hotel_phone',
                    'hotel_email',
                    'hotel_address',
                    'hotel_hours',
                    'support_whatsapp_number',
                    'support_instagram_url',
                    'support_facebook_url',
                ])
                ->pluck('value', 'key'); // ['hotel_name' => '...', ...]

            // helper to get value with fallback
            $get = function ($key, $fallback = null) use ($settings) {
                return $settings[$key] ?? $fallback;
            };

            // build absolute logo URL using DASHBOARD base
            $assetBase = rtrim(env('APP_DASHBOARD_ASSET_BASE', ''), '/');
            $rawLogoPath = $get('hotel_logo_url'); // e.g. "/storage/logos/abc.jpg"

            // if we have both base and path, combine them
            $fullLogoUrl = null;
            if ($assetBase && $rawLogoPath) {
                // ensure we don't get double slashes
                $fullLogoUrl = $assetBase . '/' . ltrim($rawLogoPath, '/');
            }

            return [
                // Branding
                'name'    => $get('hotel_name'),
                'tagline' => $get('hotel_tagline'),
                'logo'    => $fullLogoUrl, // <-- now points to http://localhost:8000/storage/...

                // Contact
                'phone'   => $get('hotel_phone'),
                'email'   => $get('hotel_email'),
                'address' => $get('hotel_address'),
                'hours'   => $get('hotel_hours'),

                // Social
                'whatsapp'  => $get('support_whatsapp_number', ''),
                'instagram' => $get('support_instagram_url', ''),
                'facebook'  => $get('support_facebook_url', ''),

                // Static / legal footer info
                'company' => 'PT Tohjaya Digital Solution',
                'url'     => $assetBase ?: 'http://localhost:8000', // we also reuse this for footer links
            ];
        });
    }
}
