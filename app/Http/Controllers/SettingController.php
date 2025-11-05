<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class SettingController extends Controller
{
    public function index()
    {
        // ambil semua settings dari DB
        $settings = Setting::all()
            ->keyBy('key')
            ->map(fn ($row) => [
                'value' => $row->value,
                'type' => $row->type,
                'group' => $row->group,
                'description' => $row->description,
            ]);

        return Inertia::render('Settings', [
            'settings' => $settings,
        ]);
    }

    public function update(Request $request)
    {
        // kita terima multipart/form-data (ada file logo)
        // field text:
        $basicFields = [
            'hotel_name',
            'hotel_tagline',
            'hotel_phone',
            'hotel_email',
            'hotel_address',
            'hotel_hours',
            'support_whatsapp_number',
            'support_instagram_url',
            'support_facebook_url',
        ];

        $advancedFields = [
            'n8n_secret_token',
            'gemini_api_key',
        ];

        // validate text input
        $validated = $request->validate([
            // basic
            'hotel_name' => ['nullable','string','max:255'],
            'hotel_tagline' => ['nullable','string','max:255'],
            'hotel_phone' => ['nullable','string','max:255'],
            'hotel_email' => ['nullable','string','max:255'],
            'hotel_address' => ['nullable','string'],
            'hotel_hours' => ['nullable','string','max:255'],
            'support_whatsapp_number' => ['nullable','string','max:255'],
            'support_instagram_url' => ['nullable','string','max:255'],
            'support_facebook_url' => ['nullable','string','max:255'],

            // advanced
            'n8n_secret_token' => ['nullable','string','max:255'],
            'gemini_api_key' => ['nullable','string','max:255'],

            // file
            'hotel_logo_file' => ['nullable','file','mimes:png,jpg,jpeg,webp,svg','max:2048'],
        ]);

        // 1. handle logo upload kalau ada
        if ($request->hasFile('hotel_logo_file')) {
            $file = $request->file('hotel_logo_file');

            // simpan ke storage/app/public/logos/
            $path = $file->store('logos', 'public'); // return "logos/xxxxx.png"

            // simpan ke setting hotel_logo_url
            $this->upsertSetting('hotel_logo_url', '/storage/'.$path, 'image', 'branding', 'Path logo utama hotel.');
        }

        // 2. update basic fields
        foreach ($basicFields as $key) {
            if ($request->has($key)) {
                $this->upsertSetting(
                    $key,
                    $validated[$key] ?? '',
                    'string',
                    $this->guessGroup($key),
                    $this->describeKey($key)
                );
            }
        }

        // 3. update advanced fields
        foreach ($advancedFields as $key) {
            // kalau ga dikirim, kita gak update (jadi ga ke-null-in tanpa sengaja)
            if ($request->has($key)) {
                $this->upsertSetting(
                    $key,
                    $validated[$key] ?? '',
                    'secret',
                    'advanced',
                    $this->describeKey($key)
                );
            }
        }

        return redirect()
            ->route('settings.index')
            ->with('success', 'Settings updated.');
    }

    /**
     * upsertSetting:
     * - kalau setting dengan key ada → update value
     * - kalau belum ada → create
     */
    protected function upsertSetting(string $key, string $value, string $type, string $group, string $desc)
    {
        Setting::updateOrCreate(
            ['key' => $key],
            [
                'value' => $value,
                'type' => $type,
                'group' => $group,
                'description' => $desc,
            ]
        );
    }

    /**
     * group otomatis berdasarkan key
     */
    protected function guessGroup(string $key): string
    {
        if (str_starts_with($key, 'hotel_')) return 'branding';
        if (str_starts_with($key, 'support_')) return 'contact';
        if (in_array($key, ['n8n_secret_token','gemini_api_key'])) return 'advanced';
        return 'general';
    }

    /**
     * deskripsi default biar gak kosong banget
     */
    protected function describeKey(string $key): string
    {
        return match ($key) {
            'hotel_name' => 'Nama hotel yang ditampilkan di header dan footer.',
            'hotel_tagline' => 'Tagline singkat hotel.',
            'hotel_phone' => 'Nomor telepon utama hotel.',
            'hotel_email' => 'Email customer service hotel.',
            'hotel_address' => 'Alamat lengkap hotel.',
            'hotel_hours' => 'Jam operasional customer support.',
            'support_whatsapp_number' => 'Nomor WhatsApp untuk customer support.',
            'support_instagram_url' => 'Link Instagram hotel.',
            'support_facebook_url' => 'Link Facebook hotel.',
            'n8n_secret_token' => 'Token keamanan untuk webhook n8n.',
            'gemini_api_key' => 'API key untuk Gemini AI.',
            default => $key,
        };
    }
}
