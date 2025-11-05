<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str; // <-- Tambahkan ini

class ServiceCategory extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
    ];

    public function services()
    {
        return $this->hasMany(Service::class, 'category_id');
    }

    /**
     * Boot method untuk auto-generating slugs.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($m) {
            if (empty($m->slug) && !empty($m->name)) {
                $m->slug = static::uniqueSlug($m->name);
            }
        });

        static::updating(function ($m) {
            // Cek jika 'name' berubah dan 'slug' tidak di-set secara manual
            if ($m->isDirty('name') && !$m->isDirty('slug')) {
                $m->slug = static::uniqueSlug($m->name, $m->id);
            }
        });
    }

    /**
     * Helper untuk membuat unique slug.
     */
    protected static function uniqueSlug(string $name, $ignoreId = null): string
    {
        $base = Str::slug($name ?: 'category');
        $slug = $base;
        $i = 2;

        // Query untuk memeriksa slug yang ada
        $query = static::query()->where('slug', $slug);
        
        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        // Loop jika slug sudah ada
        while ($query->clone()->exists()) {
            $slug = $base . '-' . $i++;
            // Reset query untuk pengecekan slug baru
            $query = static::query()->where('slug', $slug);
            if ($ignoreId) {
                $query->where('id', '!=', $ignoreId);
            }
        }

        return $slug;
    }
}
