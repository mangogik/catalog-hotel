<?php

use App\Models\Setting;
use Illuminate\Support\Facades\Schema;

if (! function_exists('setting')) {
    function setting(string $key, $default = null)
    {
        try {
            if (!Schema::hasTable('settings')) {
                return $default;
            }
            return Setting::where('key', $key)->value('value') ?? $default;
        } catch (\Throwable $e) {
            return $default;
        }
    }
}
