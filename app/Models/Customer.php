<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'name',
        'email',
        'phone',
        'passport_country',
        'total_visits',
        'last_visit_date',
        'birth_date',
        'notes',
        'preferred_language',
    ];

    protected $casts = [
        'birth_date'       => 'date',
        'last_visit_date'  => 'date',
        'preferred_language' => 'string',
    ];

    protected $attributes = [
        'total_visits' => 0,
    ];

    public function interactions()
    {
        return $this->hasMany(BookingInteraction::class);
    }

    public function membership()
    {
        return $this->hasOne(Membership::class);
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function latestBooking()
    {
        return $this->hasOne(Booking::class)->latest('checkin_at');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function incrementVisits($checkinDate)
    {
        $this->total_visits += 1;
        $this->last_visit_date = $checkinDate;
        $this->save();

        if ($this->membership) {
            $membership = $this->membership;
            $membership->total_bookings += 1;

            if ($membership->total_bookings >= 10) {
                $membership->membership_type = 'platinum';
                $membership->discount_percentage = 20.00;
            } elseif ($membership->total_bookings >= 5) {
                $membership->membership_type = 'gold';
                $membership->discount_percentage = 15.00;
            } elseif ($membership->total_bookings >= 3) {
                $membership->membership_type = 'silver';
                $membership->discount_percentage = 10.00;
            }

            $membership->save();
        }
    }
}
