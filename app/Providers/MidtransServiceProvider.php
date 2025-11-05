<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Midtrans\Config;

class MidtransServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Config::$serverKey    = setting('midtrans_server_key', config('midtrans.server_key'));
        Config::$isProduction = setting('midtrans_is_production', config('midtrans.is_production'));
        Config::$isSanitized  = config('midtrans.is_sanitized');
        Config::$is3ds        = config('midtrans.is_3ds');
    }
}
