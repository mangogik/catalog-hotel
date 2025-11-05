<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

// 1. Import HTML Purifier
use HTMLPurifier;
use HTMLPurifier_Config;

class Service extends Model
{
    protected $fillable = [
        'name',
        'description', //
        'price',
        'type',
        'fulfillment_type',
        'offering_session',
        'unit_name',
        'options',
        'membership_discount',
        'category_id', //
    ];

    protected $casts = [
        'options' => 'array', //
        'membership_discount' => 'array', //
    ];

    /**
     * The accessors to append to the model's array form.
     * Ini memaksa $service->description_html untuk selalu ditambahkan
     * saat model dikirim ke frontend.
     */
    protected $appends = ['description_html'];

    /**
     * Properti static untuk menyimpan instance purifier (efisien)
     */
    protected static $purifier;

    /* ----------------- Relationships ----------------- */

    public function category(): BelongsTo //
    {
        return $this->belongsTo(ServiceCategory::class, 'category_id');
    }

    public function orders(): BelongsToMany //
    {
        return $this->belongsToMany(Order::class, 'order_service')
            ->withPivot(['quantity', 'price_per_unit', 'details'])
            ->withTimestamps();
    }

    public function promotions(): BelongsToMany //
    {
        return $this->belongsToMany(Promotion::class, 'promotion_services');
    }

    public function serviceQuestions(): HasMany //
    {
        return $this->hasMany(ServiceQuestion::class);
    }

    public function images(): HasMany //
    {
        return $this->hasMany(ServiceImage::class);
    }

    public function optionImages(): HasMany //
    {
        return $this->hasMany(ServiceOptionImage::class);
    }

    public function activeQuestion(): HasOne //
    {
        return $this->hasOne(ServiceQuestion::class)->where('is_active', true);
    }

    /* ----------------- Accessors ----------------- */

    public function getActiveQuestionsAttribute() //
    {
        $activeQuestion = $this->activeQuestion;
        return $activeQuestion ? $activeQuestion->questions_json : [];
    }

    /**
     * Accessor: Membersihkan (Sanitize) HTML dari 'description'
     * saat dipanggil melalui $service->description_html.
     *
     * @return string|null
     */
    public function getDescriptionHtmlAttribute(): ?string
    {
        $dirtyHtml = $this->attributes['description'];
        
        if (empty($dirtyHtml)) {
            return null;
        }

        // Gunakan purifier yang sudah diinisialisasi di boot()
        return static::$purifier->purify($dirtyHtml);
    }


    /* ----------------- Helpers & Boot ----------------- */

    protected static function boot()
    {
        parent::boot();

        // Inisialisasi HTML Purifier (menggantikan CommonMark)
        if (!static::$purifier) {
            $config = HTMLPurifier_Config::createDefault();
            
            // Tentukan di mana cache disimpan (WAJIB)
            // Pastikan folder storage/app/purifier ada dan writable
            $config->set('Cache.SerializerPath', storage_path('framework/cache'));
            
            // Tentukan tag dan atribut yang AMAN (INI PENTING)
            // Ini mengizinkan bold, italic, underline, list, dan link
            $config->set('HTML.Allowed', 'p,br,b,strong,i,em,u,ul,ol,li,a[href|title]');
            
            // Anda bisa tambahkan 'img[src|alt|title]' jika Anda ingin mengizinkan
            // gambar di dalam deskripsi, tapi pastikan Anda percaya sumbernya.
            
            // Izinkan link auto-format
            $config->set('AutoFormat.Linkify', true);

            static::$purifier = new HTMLPurifier($config);
        }
        
        // Kode 'slug' Anda yang sudah ada
        static::creating(function ($m) {
            if (empty($m->slug) && !empty($m->name)) {
                $m->slug = static::uniqueSlug($m->name);
            }
        });

        static::updating(function ($m) {
            if ($m->isDirty('name')) {
                $m->slug = static::uniqueSlug($m->name, $m->id);
            }
        });
    }

    protected static function uniqueSlug(string $name, $ignoreId = null): string //
    {
        $base = Str::slug($name ?: 'service');
        $slug = $base;
        $i = 2;

        $query = static::query();
        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        while ($query->where('slug', $slug)->exists()) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }

    public function isMultipleOptions(): bool //
    {
        return $this->type === 'multiple_options';
    }
}