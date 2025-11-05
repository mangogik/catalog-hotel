<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'customer_id',
        'booking_id',
        'status',              // 'pending' | 'paid' | 'cancelled' (masih dipakai di UI)
        'payment_preference',  // 'cash' | 'online'
        'subtotal',
        'discount_total',
        'grand_total',
        'notes',   
        'order_code'         
    ];

    protected $casts = [
        'subtotal'        => 'decimal:2',
        'discount_total'  => 'decimal:2',
        'grand_total'     => 'decimal:2',
        'created_at'      => 'datetime',
        'updated_at'      => 'datetime',
    ];

    // Optional: supaya 'total_price' ikut keluar otomatis saat toArray()
    protected $appends = ['total_price'];

    /* =========================
       Relationships
       ========================= */

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function services()
    {
        return $this->belongsToMany(Service::class)
            ->withPivot(['quantity', 'price_per_unit', 'details', 'answers_json'])
            ->withTimestamps();
    }
    // NEW: dibutuhkan controller untuk load daftar pembayaran per order
    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    // Catatan/pengingat (punyamu sebelumnya — tetap dipertahankan)
    public function reminders()
    {
        return $this->hasMany(Reminder::class, 'target_id')
            ->where('target_type', 'order');
    }

    // Jejak pemakaian promo (model kamu sudah ada)
    public function promotionsUsed()
    {
        return $this->hasMany(PromotionUsed::class, 'order_id');
    }

    // Relasi many-to-many ke promotions lewat tabel promotions_used (kalau mau dipakai)
    public function promotions()
    {
        return $this->belongsToMany(Promotion::class, 'promotions_used')
            ->withPivot(['discount_applied', 'free_service_id', 'free_service_qty', 'snapshot_json'])
            ->withTimestamps();
    }

    /* =========================
       Accessors / Computed
       ========================= */

    /**
     * total_price (legacy) — jumlah dari item (qty * price_per_unit).
     * Untuk tampilan, kamu bisa pilih menonjolkan grand_total bila tersedia.
     */
    public function getTotalPriceAttribute()
    {
        // Jika sudah ada grand_total di DB (setelah promo & rounding), pakai itu
        if (!is_null($this->grand_total)) {
            return (float) $this->grand_total;
        }

        // Fallback: hitung dari pivot services
        if (!$this->relationLoaded('services')) {
            // menghindari N+1 saat dipanggil tanpa eager load
            $this->loadMissing('services');
        }

        return (float) $this->services->sum(function ($service) {
            $qty  = (float) ($service->pivot->quantity ?? 0);
            $ppu  = (float) ($service->pivot->price_per_unit ?? 0);
            return $qty * $ppu;
        });
    }
}
