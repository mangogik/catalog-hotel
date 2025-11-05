<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceImage extends Model
{
    protected $fillable = [
        'service_id',
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
