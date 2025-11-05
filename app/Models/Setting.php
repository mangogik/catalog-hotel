<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $table = 'settings';

    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'description',
    ];

    public $timestamps = true;

    /**
     * Ambil value setting via key.
     * Contoh: Setting::getValue('n8n_order_webhook_url')
     */
    public static function getValue(string $key, $default = null)
    {
        return Cache::remember("setting_{$key}", 60, function () use ($key, $default) {
            $row = static::where('key', $key)->first();
            return $row ? $row->value : $default;
        });
    }

    /**
     * Opsional helper boolean (kalau nanti kamu tambah n8n_enabled).
     */
    public static function getBool(string $key, bool $default = false): bool
    {
        $val = static::getValue($key, $default ? '1' : '0');

        if (is_bool($val)) return $val;

        $valLower = strtolower((string)$val);
        return in_array($valLower, ['1', 'true', 'yes', 'on'], true);
    }
}
