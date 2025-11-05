<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceOptionImage extends Model
{
    protected $fillable = [
        'service_id',
        'option_key',
        'option_name',
        'image_path',
        'caption',
    ];

    protected $appends = ['url'];

    public function getUrlAttribute()
    {
        $base = config('app.dashboard_asset_base', config('app.url'));
        return rtrim($base, '/') . '/storage/' . ltrim($this->image_path, '/');
    }


    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}
