<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $settings = [
            // 🏨 Branding
            [
                'key' => 'hotel_name',
                'value' => 'Tohjaya Hotel',
                'type' => 'string',
                'group' => 'branding',
                'description' => 'Nama hotel yang ditampilkan di header dan footer.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'hotel_tagline',
                'value' => 'Boutique comfort in the heart of the city.',
                'type' => 'string',
                'group' => 'branding',
                'description' => 'Tagline singkat hotel.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'hotel_logo_url',
                'value' => '/storage/logos/main.png',
                'type' => 'image',
                'group' => 'branding',
                'description' => 'Path logo utama hotel.',
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // ☎️ Contact
            [
                'key' => 'hotel_phone',
                'value' => '(+62) 777 999',
                'type' => 'string',
                'group' => 'contact',
                'description' => 'Nomor telepon utama hotel.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'hotel_email',
                'value' => 'support@tohjayahotel.com',
                'type' => 'string',
                'group' => 'contact',
                'description' => 'Email customer service hotel.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'hotel_address',
                'value' => 'Jl. Mawar No. 123, Malang, Indonesia',
                'type' => 'text',
                'group' => 'contact',
                'description' => 'Alamat lengkap hotel.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'hotel_hours',
                'value' => 'Mon – Sun: 10 am – 6 pm',
                'type' => 'string',
                'group' => 'contact',
                'description' => 'Jam operasional customer support.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'support_whatsapp_number',
                'value' => '+628123456789',
                'type' => 'string',
                'group' => 'contact',
                'description' => 'Nomor WhatsApp untuk customer support.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'support_instagram_url',
                'value' => 'https://instagram.com/tohjayahotel',
                'type' => 'string',
                'group' => 'contact',
                'description' => 'Link Instagram hotel.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'support_facebook_url',
                'value' => 'https://facebook.com/tohjayahotel',
                'type' => 'string',
                'group' => 'contact',
                'description' => 'Link Facebook hotel.',
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // 🤖 Automation / Integrations
            [
                'key' => 'n8n_secret_token',
                'value' => env('N8N_SECRET_TOKEN'), // ambil dari .env
                'type' => 'secret',
                'group' => 'automation',
                'description' => 'Token rahasia untuk memanggil workflow N8N.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'ai_api_key',
                'value' => env('GEMINI_API_KEY'), // ambil dari .env
                'type' => 'secret',
                'group' => 'automation',
                'description' => 'API key untuk layanan AI (contoh: Gemini).',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('settings')->insert($settings);
    }
}
