<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $fillable = [
        'customer_id',
        'room_id',
        'checkin_at',
        'checkout_at',
        'status',
        'notes',
        'source',
        'access_token', // ← token di-generate dari dashboard, jadi boleh diisi manual
    ];

    protected $casts = [
        'checkin_at'  => 'datetime',
        'checkout_at' => 'datetime',
    ];

    /**
     * Field virtual agar ikut tampil di array/JSON.
     */
    protected $appends = ['room_label'];

    // -----------------
    // Relations
    // -----------------

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function interactions()
    {
        return $this->hasMany(BookingInteraction::class)->orderBy('created_at', 'desc');
    }

    public function reminders()
    {
        return $this->hasMany(Reminder::class, 'target_id')
            ->where('target_type', 'booking');
    }

    // -----------------
    // Accessors
    // -----------------

    /**
     * Contoh output: "Room 101 (Deluxe)"
     * Menggunakan relasi room → roomType, bukan kolom room_type di tabel rooms.
     */
    public function getRoomLabelAttribute(): ?string
    {
        // Pastikan relasi room dan roomType sudah termuat
        if (!$this->relationLoaded('room') && $this->room_id) {
            $this->loadMissing(
                'room:id,room_number,room_type_id',
                'room.roomType:id,name'
            );
        }

        if (!$this->room) {
            return null;
        }

        $label = 'Room ' . $this->room->room_number;

        if ($this->room->roomType) {
            $label .= ' (' . $this->room->roomType->name . ')';
        }

        return $label;
    }

    // -----------------
    // Hooks
    // -----------------

    /**
     * Catatan:
     * Kita sengaja menghapus hook `creating()` untuk generate access_token
     * karena token akan di-generate di sistem dashboard, bukan di katalog.
     */
}
