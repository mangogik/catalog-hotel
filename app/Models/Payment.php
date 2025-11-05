<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'order_id',
        'amount',
        'method',          // 'cash' | 'online'
        'currency',        // e.g. 'IDR'
        'status',          // 'pending' | 'paid' | 'failed' | 'refunded'
        'gateway',         // 'xendit' | 'manual' | dll
        'external_id',
        'invoice_id',
        'payment_url',
        'failure_reason',
        'paid_at',
        'meta',
    ];

    protected $casts = [
        'amount'   => 'decimal:2',
        'paid_at'  => 'datetime',
        'meta'     => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function customer()
    {
        return $this->hasOneThrough(Order::class, 'customer');
    }
}
