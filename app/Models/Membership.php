<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Membership extends Model
{
    protected $fillable = [
        'customer_id',
        'membership_type',
        'join_date',
        'total_bookings',
        'discount_percentage'
    ];

    protected $casts = [
        'join_date' => 'date'
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
