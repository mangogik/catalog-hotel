<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    // Kolom sesuai migration sederhana kita
    protected $fillable = [
        'name',
        'type',                 // 'birthday' | 'event' | 'membership'
        'active',               // bool
        'discount_percent',     // nullable
        'discount_amount',      // nullable
        'free_service_id',      // nullable
        'free_service_qty',     // default 1
        'birthday_days_before', // default 3
        'membership_tier',      // nullable
        'event_code',           // nullable
    ];

    protected $casts = [
        'active'               => 'boolean',
        'discount_percent'     => 'integer',
        'discount_amount'      => 'decimal:2',
        'free_service_id'      => 'integer',
        'free_service_qty'     => 'integer',
        'birthday_days_before' => 'integer',
        'created_at'           => 'datetime',
        'updated_at'           => 'datetime',
    ];

    /* ==========================
       Relationships
       ========================== */

    // Layanan yang eligible untuk promo (pivot promotion_services)
    public function services()
    {
        return $this->belongsToMany(Service::class, 'promotion_services');
    }

    // Jika aksi promo berupa free service
    public function freeService()
    {
        return $this->belongsTo(Service::class, 'free_service_id');
    }

    // Jejak pemakaian promo per order
    public function usages()
    {
        return $this->hasMany(PromotionUsed::class, 'promotion_id');
    }

    /* ==========================
       Scopes kecil & helpers
       ========================== */

    public function scopeActive($q)
    {
        return $q->where('active', true);
    }

    public function scopeType($q, string $type)
    {
        return $q->where('type', $type);
    }
}
