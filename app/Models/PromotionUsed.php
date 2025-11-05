<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PromotionUsed extends Model
{
    // Tabel bukan plural default Laravel, jadi set manual
    protected $table = 'promotions_used';

    protected $fillable = [
        'order_id',
        'promotion_id',
        'discount_applied',
        'free_service_id',
        'free_service_qty',
        'snapshot_json',
    ];

    protected $casts = [
        'discount_applied' => 'decimal:2',
        'free_service_id'  => 'integer',
        'free_service_qty' => 'integer',
        'snapshot_json'    => 'array',
        'created_at'       => 'datetime',
        'updated_at'       => 'datetime',
    ];

    /* ==========================
       Relationships
       ========================== */

    public function promotion()
    {
        return $this->belongsTo(Promotion::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    // Bila promo memberikan free service
    public function freeService()
    {
        return $this->belongsTo(Service::class, 'free_service_id');
    }
}
