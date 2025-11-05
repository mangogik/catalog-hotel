<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reminder extends Model
{
    use HasFactory;

    /**
     * Kolom yang boleh diisi secara massal (mass assignable).
     *
     * @var array
     */
    protected $fillable = [
        'reminder_type',
        'target_id',
        'target_type',
        'scheduled_at',
        'status',
        'sent_at',
    ];

    /**
     * Mengubah tipe data asli dari kolom untuk kemudahan penggunaan.
     *
     * @var array
     */
    protected $casts = [
        'scheduled_at' => 'datetime',
        'sent_at' => 'datetime',
    ];

    /**
     * Mendefinisikan relasi: Sebuah Reminder dimiliki oleh sebuah Booking.
     * Relasi ini menggunakan kolom 'target_id' sebagai foreign key.
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class, 'target_id');
    }

    /**
     * Mendefinisikan relasi: Sebuah Reminder dimiliki oleh sebuah Order.
     * Relasi ini menggunakan kolom 'target_id' sebagai foreign key.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'target_id');
    }
}
